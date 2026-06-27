import { Mark, mergeAttributes } from "@tiptap/core";

// Underline and Link are not in @tiptap/starter-kit and the standalone
// extensions aren't installed, so we define the two marks inline. They are
// deliberately minimal — just enough to round-trip the <u> and <a> tags the
// reader's sanitiser allows (see src/lib/rich-text.ts).

export const Underline = Mark.create({
  name: "underline",
  parseHTML() {
    return [
      { tag: "u" },
      {
        style: "text-decoration",
        consuming: false,
        getAttrs: (value) =>
          typeof value === "string" && value.includes("underline")
            ? {}
            : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["u", mergeAttributes(HTMLAttributes), 0];
  },
  addKeyboardShortcuts() {
    return { "Mod-u": () => this.editor.commands.toggleMark(this.name) };
  },
});

export const Link = Mark.create({
  name: "link",
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,
  addAttributes() {
    return {
      href: { default: null },
      target: { default: "_blank" },
      rel: { default: "noopener noreferrer nofollow" },
    };
  },
  parseHTML() {
    return [{ tag: "a[href]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes), 0];
  },
});
