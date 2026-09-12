import type { ReactNode } from "react";
import { CoverRichText } from "./cover-rich-text";
import type { CoverElement, CoverSource } from "@/lib/cover-elements";
import { previewTitle } from "@/lib/cover-elements";
import type { ImageMap } from "@/lib/images";
import { BlockImage } from "./block-view";

/** The same editorial type and resolved content on the canvas, in print and on phones. */
export function CoverElementView({
  element,
  sources = [],
  issueNo = 0,
  images,
  editing = false,
  renderText,
}: {
  element: CoverElement;
  sources?: CoverSource[];
  issueNo?: number;
  images: ImageMap;
  editing?: boolean;
  renderText?: (field: string, text: string, label: string) => ReactNode;
}) {
  const copy = (field: string, text: string, label: string) =>
    renderText ? (
      renderText(field, text, label)
    ) : (
      <CoverRichText text={text} doc={element.placement.richText?.[field]} />
    );
  const P = renderText ? "div" : "p";
  const H3 = renderText ? "div" : "h3";
  if (element.type === "logo") {
    const image = element.imageId ? images[element.imageId] : undefined;
    return image ? (
      <div
        className="cover-logo"
        style={{
          width: element.size,
          maxWidth: "100%",
          aspectRatio: (image.width || 1) / (image.height || 1),
        }}
      >
        <BlockImage
          image={image}
          alt={element.alt || "Magazine logo"}
          fit="contain"
        />
      </div>
    ) : editing ? (
      <P className="cover-element-empty">Choose a logo</P>
    ) : null;
  }
  if (element.type === "details") {
    const parts = [
      element.showNumber ? `Issue ${String(issueNo).padStart(2, "0")}` : "",
      element.text,
    ].filter(Boolean);
    return (
      <P data-cover-copy className="cover-issue-details">
        {element.showNumber && (
          <span>
            {parts[0]}
            {element.text ? " · " : ""}
          </span>
        )}
        {copy("text", element.text, "Date or edition")}
      </P>
    );
  }
  const entries = element.items.filter(
    (item) => editing || previewTitle(item, sources) || item.description,
  );
  const story = (item: (typeof entries)[number]) => {
    const title = previewTitle(item, sources);
    const source = sources.find((s) => s.id === item.headingId);
    return (
      <>
        {(title || editing) && (
          <H3 data-cover-copy className="cover-stories-headline">
            {copy(`${item.id}:title`, title, "Story headline")}
          </H3>
        )}
        {item.description && (
          <P data-cover-copy className="cover-story-description">
            {copy(
              `${item.id}:description`,
              item.description,
              "Supporting text",
            )}
          </P>
        )}
        {element.showPageNumbers && source && (
          <P data-cover-copy className="cover-story-page">
            Page {source.pageNo}
          </P>
        )}
      </>
    );
  };
  return (
    <div className="cover-stories" data-headline-size={element.headlineSize}>
      {element.title && (
        <H3 data-cover-copy className="cover-stories-heading">
          {copy("title", element.title, "List heading")}
        </H3>
      )}
      {entries.length > 1 ? (
        <ol className="cover-stories-list">
          {entries.map((item) => (
            <li key={item.id}>{story(item)}</li>
          ))}
        </ol>
      ) : (
        entries[0] && story(entries[0])
      )}
    </div>
  );
}
