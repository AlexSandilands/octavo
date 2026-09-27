import {
  AI_VIEWS_PER_RUN,
  aiToolSchemas,
  type AiToolOutput,
  type AiViewTool,
} from "@/lib/ai-tools";
import {
  AI_PHOTO_PATH,
  AI_RENDER_PATH,
  type AiPhotoResponse,
  type AiRenderedPage,
  type AiRenderResponse,
} from "@/lib/ai-vision-contract";
import { CONTENT_VERSION } from "@/lib/blocks";
import type { AssistantIssue } from "./issue-context";
import { describeFill, fillFromMeasure } from "./page-fill";
import { shape } from "./projection-text";

// The assistant's eyes (#342): `view_page` and `view_photo` answered with a
// picture inside the tool result, within a budget of views per run, and the
// pictures the end-of-run review sends. The pictures come from the server
// (api/admin/ai/render, …/photo), which draws a page the way the PDF does from
// the issue as the editor holds it, unsaved edits included.

/** What the page pictures need beyond the issue the projection reads. */
export type VisionSource = { issueId: string; logoId: string | null };

const views = (n: number) => `${n} view${n === 1 ? "" : "s"} left`;

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Pages as members will see them, in the order asked; a failure is empty. */
export async function picturePages(
  source: VisionSource,
  issue: AssistantIssue,
  pages: number[],
): Promise<AiRenderedPage[]> {
  const res = await post<AiRenderResponse>(AI_RENDER_PATH, {
    issueId: source.issueId,
    theme: issue.theme,
    logoId: source.logoId,
    content: { version: CONTENT_VERSION, pages: issue.pages },
    pages,
  });
  return res?.pages ?? [];
}

/** "Page 4 (fits, ~70% full)", "Page 1 (the cover)". */
export function pageCaption(page: AiRenderedPage, issue: AssistantIssue) {
  const owned = issue.fills[issue.pages[page.page - 1]?.id ?? ""];
  const fill = page.cover
    ? "the cover"
    : page.fill
      ? describeFill(fillFromMeasure(page.fill))
      : describeFill(owned);
  return `Page ${page.page} (${fill})`;
}

/** Where pictures come from: the admin routes, or the model-selection
 *  fixture's own renderer (#315), which has no saved draft to post. */
export type VisionEyes = {
  pages: typeof picturePages;
  photo: (
    source: VisionSource,
    imageId: string,
  ) => Promise<AiPhotoResponse | null>;
};

const routeEyes: VisionEyes = {
  pages: picturePages,
  photo: (source, imageId) =>
    post<AiPhotoResponse>(AI_PHOTO_PATH, { issueId: source.issueId, imageId }),
};

export function createVision(eyes: VisionEyes = routeEyes) {
  let used = 0;
  // Pictures the conversation has room for, as the run started (#308's cap).
  let room = Infinity;
  const left = () => Math.min(AI_VIEWS_PER_RUN, room) - used;

  const viewPage = async (
    input: unknown,
    issue: AssistantIssue,
    source: VisionSource,
  ): Promise<AiToolOutput> => {
    const args = aiToolSchemas.view_page.safeParse(input);
    if (!args.success)
      return { text: "view_page needs a page number, like { page: 3 }." };
    const { page } = args.data;
    if (!issue.pages[page - 1])
      return {
        text: `Error: there is no page ${page}; this issue has ${issue.pages.length} pages.`,
      };
    const [shot] = await eyes.pages(source, issue, [page]);
    if (!shot)
      return {
        text: `Error: page ${page} couldn't be pictured right now; carry on without it. No view was used.`,
      };
    used++;
    return {
      text: `${pageCaption(shot, issue)}. ${views(left())}.`,
      images: [{ mediaType: shot.mediaType, data: shot.data }],
    };
  };

  const viewPhoto = async (
    input: unknown,
    issue: AssistantIssue,
    source: VisionSource,
  ): Promise<AiToolOutput> => {
    const args = aiToolSchemas.view_photo.safeParse(input);
    if (!args.success)
      return { text: "view_photo needs a photo id from the projection." };
    const { imageId } = args.data;
    if (!issue.uploads.includes(imageId))
      return {
        text: `Error: "${imageId}" isn't a photo uploaded to this issue.`,
      };
    const photo = await eyes.photo(source, imageId);
    if (!photo)
      return {
        text: `Error: photo ${imageId} couldn't be shown just now. No view was used.`,
      };
    used++;
    return {
      text: `Photo ${imageId} (${shape(issue.images[imageId])}). ${views(left())}.`,
      images: [{ mediaType: photo.mediaType, data: photo.data }],
    };
  };

  return {
    /** A new author message: a fresh budget of views, within the conversation's room. */
    beginRun(pictures: number) {
      used = 0;
      room = pictures;
    },
    /** Pictures the conversation still has room for (the review takes its pages from these). */
    room: () => Math.max(0, room - used),
    view(
      tool: AiViewTool,
      input: unknown,
      issue: AssistantIssue,
      source: VisionSource,
    ): Promise<AiToolOutput> {
      const more = `${Math.max(0, room - used)} more picture${room - used === 1 ? "" : "s"}`;
      if (used >= AI_VIEWS_PER_RUN)
        return Promise.resolve({
          text: `Error: you have used all ${AI_VIEWS_PER_RUN} views for this request; finish from what you know. This conversation has room for ${more}.`,
        });
      if (used >= room)
        return Promise.resolve({
          text: "Error: this conversation has no room for more pictures; finish from what you know. A new conversation starts afresh.",
        });
      return tool === "view_page"
        ? viewPage(input, issue, source)
        : viewPhoto(input, issue, source);
    },
  };
}
