// The vision tools: `view_page` (a picture of a page as members will see it)
// and `view_photo` (an uploaded photo, downscaled). Offered only with --vision.
// They share one per-run budget of views, since each image costs ~1–2k tokens.
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { z } from "zod";
import { describeFill, estimateFill } from "./fill.ts";
import { Renderer } from "./render.ts";
import { issueImageIds, type IssueContext } from "./seed.ts";

export const visionSchemas = {
  view_page: z.object({ page: z.number().int().min(1).max(200) }).strict(),
  view_photo: z.object({ imageId: z.string().min(1).max(64) }).strict(),
} as const;
export type VisionTool = keyof typeof visionSchemas;
export const VISION_TOOLS = Object.keys(visionSchemas) as VisionTool[];

export const visionDefinitions = (budget: number) => [
  {
    name: "view_page",
    description: `See a picture of one page exactly as members will see it: fonts, photos, the running footer, and the cover as designed. You have ${budget} views (pages and photos together) for this request; use them to check work that text can't show you (a cover, a photo's placement, whether a page looks balanced).`,
    inputSchema: {
      type: "object",
      properties: {
        page: {
          type: "integer",
          minimum: 1,
          maximum: 200,
          description: "Page number, 1-based.",
        },
      },
      required: ["page"],
      additionalProperties: false,
    },
  },
  {
    name: "view_photo",
    description: `See one photo uploaded to the issue (placed or not), to learn what it shows before choosing where it goes. Shares the ${budget}-view budget with view_page.`,
    inputSchema: {
      type: "object",
      properties: {
        imageId: {
          type: "string",
          description: "A photo id from the projection.",
        },
      },
      required: ["imageId"],
      additionalProperties: false,
    },
  },
];

type Content =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };
export type VisionResult = { ok: boolean; content: Content[]; logText: string };

export class Vision {
  private used = 0;
  private renderer: Renderer;

  constructor(
    private budget: number,
    settings: ConstructorParameters<typeof Renderer>[0] = {},
  ) {
    this.renderer = new Renderer(settings);
  }

  async run(
    ctx: IssueContext,
    name: VisionTool,
    args: unknown,
  ): Promise<VisionResult> {
    const fail = (text: string): VisionResult => ({
      ok: false,
      content: [{ type: "text", text: `Error: ${text}` }],
      logText: `Error: ${text}`,
    });
    const parsed = visionSchemas[name].safeParse(args);
    if (!parsed.success)
      return fail(
        `invalid arguments for ${name} — ${parsed.error.issues[0]?.path.join(".")}: ${parsed.error.issues[0]?.message}`,
      );
    if (this.used >= this.budget)
      return fail(
        `you have used all ${this.budget} views for this request; finish from what you know`,
      );

    if (name === "view_page") {
      const { page } = parsed.data as { page: number };
      if (!ctx.content.pages[page - 1])
        return fail(
          `there is no page ${page}; the issue has ${ctx.content.pages.length} pages`,
        );
      const { png, measured } = await this.renderer.shot(ctx, page);
      this.used++;
      const fill = ctx.content.pages[page - 1]!.cover
        ? "the cover"
        : describeFill(estimateFill(ctx.content.pages[page - 1]!, ctx.images));
      const text = `Page ${page} (${fill}). ${this.budget - this.used} view${this.budget - this.used === 1 ? "" : "s"} left.`;
      return {
        ok: true,
        content: [
          {
            type: "image",
            data: png.toString("base64"),
            mimeType: "image/png",
          },
          { type: "text", text },
        ],
        logText: `${text} [image${measured ? `; measured overflow ${measured.overflowPx}px` : ""}]`,
      };
    }

    const { imageId } = parsed.data as { imageId: string };
    const info = ctx.images.get(imageId);
    if (!issueImageIds(ctx).has(imageId) || !info?.file)
      return fail(`"${imageId}" isn't a photo uploaded to this issue`);
    const jpg = await sharp(readFileSync(info.file))
      .resize({ width: 800, height: 800, fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();
    this.used++;
    const text = `Photo ${imageId} (${info.width}×${info.height}). ${this.budget - this.used} view${this.budget - this.used === 1 ? "" : "s"} left.`;
    return {
      ok: true,
      content: [
        { type: "image", data: jpg.toString("base64"), mimeType: "image/jpeg" },
        { type: "text", text },
      ],
      logText: `${text} [image]`,
    };
  }

  get views(): number {
    return this.used;
  }

  close(): Promise<void> {
    return this.renderer.close();
  }
}
