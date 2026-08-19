import { PAGE_H, PAGE_W } from "@/features/blocks/page-frame";

// The dashboard row's cover thumbnail: the issue's real cover page rendered
// small through the library's pipeline, so the box has to keep the page's
// proportions. Its own module because the server page renders the cover at this
// width and the client row reserves this box for it.
export const THUMB_W = 46;
export const THUMB_H = Math.round((THUMB_W * PAGE_H) / PAGE_W);
