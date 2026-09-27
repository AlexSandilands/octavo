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
// pictures the end-of-run review sends. A first look at a photo attached to
// the run's own message is outside that budget (#365), so attaching photos
// never costs the model its page views; every picture counts toward the
// conversation's room all the same. The pictures come from the server
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

export function createVision() {
  // Views counted against the run's budget, and every picture the run took.
  let used = 0;
  let pictured = 0;
  // Pictures the conversation has room for, as the run started (#308's cap).
  let room = Infinity;
  // Photos attached to the run's message; each one's first look is free.
  let attached = new Set<string>();
  const left = () => Math.min(AI_VIEWS_PER_RUN - used, room - pictured);
  const free = (tool: AiViewTool, input: unknown) => {
    const args =
      tool === "view_photo" && aiToolSchemas.view_photo.safeParse(input);
    return Boolean(args && args.success && attached.has(args.data.imageId));
  };

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
    const [shot] = await picturePages(source, issue, [page]);
    if (!shot)
      return {
        text: `Error: page ${page} couldn't be pictured right now; carry on without it. No view was used.`,
      };
    used++;
    pictured++;
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
    const photo = await post<AiPhotoResponse>(AI_PHOTO_PATH, {
      issueId: source.issueId,
      imageId,
    });
    if (!photo)
      return {
        text: `Error: photo ${imageId} couldn't be shown just now. No view was used.`,
      };
    const own = attached.delete(imageId);
    if (!own) used++;
    pictured++;
    return {
      text: `Photo ${imageId} (${shape(issue.images[imageId])})${own ? ", attached to this message: this look used no view" : ""}. ${views(left())}.`,
      images: [{ mediaType: photo.mediaType, data: photo.data }],
    };
  };

  return {
    /** A new author message: a fresh budget of views, within the conversation's
     *  room; `photos` are the ones attached to it (#343). */
    beginRun(pictures: number, photos: string[] = []) {
      used = 0;
      pictured = 0;
      room = pictures;
      attached = new Set(photos);
    },
    /** Pictures the conversation still has room for (the review takes its pages from these). */
    room: () => Math.max(0, room - pictured),
    view(
      tool: AiViewTool,
      input: unknown,
      issue: AssistantIssue,
      source: VisionSource,
    ): Promise<AiToolOutput> {
      const more = `${Math.max(0, room - pictured)} more picture${room - pictured === 1 ? "" : "s"}`;
      if (used >= AI_VIEWS_PER_RUN && !free(tool, input))
        return Promise.resolve({
          text: `Error: you have used all ${AI_VIEWS_PER_RUN} views for this request; finish from what you know. This conversation has room for ${more}.`,
        });
      if (pictured >= room)
        return Promise.resolve({
          text: "Error: this conversation has no room for more pictures; finish from what you know. A new conversation starts afresh.",
        });
      return tool === "view_page"
        ? viewPage(input, issue, source)
        : viewPhoto(input, issue, source);
    },
  };
}
