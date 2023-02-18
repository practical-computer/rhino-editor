import { AttachmentManager } from "src/exports/attachment-manager";
import type { AttachmentEditor } from "src/exports/elements/attachment-editor";
import { mergeAttributes, Node } from "@tiptap/core";
import { selectionToInsertionEnd } from "src/internal/selection-to-insertion-end";
import { Maybe } from "src/types";
import { findAttribute } from "./find-attribute";
import { toDefaultCaption } from "src/internal/to-default-caption";

export interface AttachmentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    attachment: {
      /**
       * Add an attachment(s)
       */
      setAttachment: (
        options: AttachmentManager | AttachmentManager[]
      ) => ReturnType;
    };
  }
}

/** https://github.com/basecamp/trix/blob/main/src/trix/models/attachment.coffee#L4 */
const isPreviewable = /^image(\/(gif|png|jpe?g)|$)/;

function canPreview(previewable: Boolean, contentType: Maybe<string>): Boolean {
  return previewable || contentType?.match(isPreviewable) != null;
}

function toExtension(fileName: Maybe<string>): string {
  if (!fileName) return "";

  return "attachment--" + fileName.match(/\.(\w+)$/)?.[1].toLowerCase();
}

function toType(content: Maybe<string>, previewable: Boolean): string {
  if (previewable) {
    return "attachment--preview";
  }

  if (content) {
    return "attachment--content";
  }

  return "attachment--file";
}

export const Attachment = Node.create({
  name: "attachment-figure",
  group: "block attachmentFigure",
  content: "inline*",
  selectable: true,
  draggable: true,
  isolating: true,
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: "attachment",
        "data-trix-attributes": JSON.stringify({ presentation: "gallery" }),
      },
    };
  },

  parseHTML() {
    return [
      // Generated by #to_trix_html
      {
        tag: "figure[data-trix-attachment]",
        // contentElement: "figcaption"
      },
      // Generated by the standard output.
      {
        tag: "figure.attachment",
        contentElement: "figcaption",
      },
    ];
  },

  renderHTML({ node }) {
    const {
      // Figure
      content,
      contentType,
      sgid,
      fileName,
      fileSize,
      caption,
      url,
      previewable,

      // Image
      src,
      width,
      height,
    } = node.attrs;

    const attachmentAttrs: Record<keyof typeof node.attrs, string> = {
      caption,
      contentType,
      content,
      filename: fileName,
      filesize: fileSize,
      height,
      width,
      sgid,
      url,
      src,
    };

    const figure = [
      "figure",
      mergeAttributes(this.options.HTMLAttributes, {
        class:
          this.options.HTMLAttributes.class +
          " " +
          toType(content, canPreview(previewable, contentType)) +
          " " +
          toExtension(fileName),
        "data-trix-content-type": contentType,
        "data-trix-attachment": JSON.stringify(attachmentAttrs),
        "data-trix-attributes": JSON.stringify({
          caption,
          presentation: "gallery",
        }),
      }),
    ] as const;

    const figcaption = [
      "figcaption",
      mergeAttributes(
        {},
        { class: "attachment__caption attachment__caption--edited" }
      ),
      0,
    ] as const;

    const image = [
      "img",
      mergeAttributes(
        {},
        {
          src: url || src,
          contenteditable: false,
          width,
          height,
        }
      ),
    ];

    if (!content) {
      return [...figure, image, figcaption];
    }

    return [...figure, figcaption];
  },

  addAttributes() {
    return {
      attachmentId: { default: null },
      caption: {
        default: "",
        parseHTML: (element) => {
          return (
            element.querySelector("figcaption")?.innerHTML ||
            findAttribute(element, "caption")
          );
        },
      },
      progress: {
        default: 100,
      },
      sgid: {
        default: "",
        parseHTML: (element) => findAttribute(element, "sgid"),
      },
      src: {
        default: "",
        parseHTML: (element) => findAttribute(element, "src"),
      },
      height: {
        default: "",
        parseHTML: (element) => findAttribute(element, "height"),
      },
      width: {
        default: "",
        parseHTML: (element) => {
          return findAttribute(element, "width");
        },
      },
      contentType: {
        default: "",
        parseHTML: (element) => {
          // This is a special case where it exists as:
          // figure["data-trix-attachment"]["contentType"] and
          // action-text-attachment["content-type"]
          return (
            findAttribute(element, "content-type") ||
            JSON.parse(element.getAttribute("data-trix-attachment") || "")
              .contentType ||
            "application/octet-stream"
          );
        },
      },
      fileName: {
        default: "",
        parseHTML: (element) => findAttribute(element, "filename"),
      },
      fileSize: {
        default: "",
        parseHTML: (element) => findAttribute(element, "filesize"),
      },
      content: {
        default: "",
        parseHTML: (element) => {
          return (
            findAttribute(element, "content") ||
            element.closest("action-text-attachment")?.innerHTML ||
            ""
          );
        },
      },
      url: {
        default: "",
        parseHTML: (element) => {
          return findAttribute(element, "url");
        },
      },
      previewable: {
        default: false,
        parseHTML: (element) => {
          const { previewable } = JSON.parse(
            element.getAttribute("data-trix-attachment") || "{}"
          );

          return previewable;
        },
      },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const {
        content,
        contentType,
        sgid,
        fileName,
        progress,
        fileSize,
        url,
        src,
        width,
        height,
        caption,
        previewable,
      } = node.attrs;

      const figure = document.createElement("figure");
      const figcaption = document.createElement("figcaption");

      if (!caption) {
        figcaption.classList.add("is-empty");
      } else {
        figcaption.classList.remove("is-empty");
      }

      figcaption.setAttribute(
        "data-default-caption",
        toDefaultCaption({ fileSize, fileName })
      );
      figcaption.setAttribute("data-placeholder", "Add a caption...");

      figcaption.classList.add("attachment__caption");

      figure.setAttribute(
        "class",
        this.options.HTMLAttributes.class +
          " " +
          toType(content, canPreview(previewable, contentType)) +
          " " +
          toExtension(fileName)
      );
      figure.setAttribute("data-trix-content-type", node.attrs.contentType);

      // Convenient way to tell us its "final"
      if (sgid) figure.setAttribute("sgid", sgid);

      figure.setAttribute(
        "data-trix-attachment",
        JSON.stringify({
          contentType,
          content,
          filename: fileName,
          filesize: fileSize,
          height,
          width,
          sgid,
          url,
          caption,
        })
      );

      figure.setAttribute(
        "data-trix-attributes",
        JSON.stringify({
          presentation: "gallery",
          caption,
        })
      );

      const attachmentEditor = document.createElement(
        "rhino-attachment-editor"
      ) as AttachmentEditor;
      attachmentEditor.setAttribute("file-name", fileName);
      attachmentEditor.setAttribute("file-size", fileSize);
      attachmentEditor.setAttribute("contenteditable", "false");

      attachmentEditor.setAttribute("progress", progress);

      figure.addEventListener("click", (e: Event) => {
        if (e.composedPath().includes(figcaption)) {
          return;
        }

        if (typeof getPos === "function") {
          editor
            .chain()
            .setTextSelection(getPos() + 1)
            .run();
        }
      });

      const img = document.createElement("img");
      img.setAttribute("contenteditable", "false");
      img.setAttribute("width", width);
      img.setAttribute("height", height);

      if (canPreview(previewable, contentType)) {
        if (url || src) {
          img.setAttribute("src", url || src);
        }
        if (!width || !height) {
          img.src = url || src;
          img.onload = () => {
            const { naturalHeight: height, naturalWidth: width } = img;

            if (typeof getPos === "function") {
              const view = editor.view;
              view.dispatch(
                view.state.tr.setNodeMarkup(getPos(), undefined, {
                  ...node.attrs,
                  height: height,
                  width: width,
                })
              );
            }
          };
        }
      }

      if (content && !canPreview(previewable, contentType)) {
        figure.innerHTML = content;
        figure.prepend(attachmentEditor);
        figure.append(figcaption);
      } else {
        figure.append(attachmentEditor, img, figcaption);
      }

      return {
        dom: figure,
        contentDOM: figcaption,
      };
    };
  },

  addCommands() {
    return {
      setAttachment:
        (options: AttachmentManager | AttachmentManager[]) =>
        ({ state, tr, dispatch }) => {
          const currentSelection = state.doc.resolve(state.selection.anchor);
          const before =
            state.selection.anchor - 2 < 0 ? 0 : state.selection.anchor - 2;
          const nodeBefore = state.doc.resolve(before);

          // If we're in a paragraph directly following a gallery.
          const isInGalleryCurrent =
            currentSelection.node(1).type.name === "attachment-gallery";
          const isInGalleryAfter =
            nodeBefore.node(1)?.type.name === "attachment-gallery";

          const isInGallery = isInGalleryCurrent || isInGalleryAfter;

          const { schema } = state;
          const attachments: AttachmentManager[] = Array.isArray(options)
            ? options
            : ([] as AttachmentManager[]).concat(options);

          const attachmentNodes = attachments.map((attachment) => {
            return schema.nodes["attachment-figure"].create(
              attachment,
              attachment.caption ? [schema.text(attachment.caption)] : []
            );
          });

          if (isInGallery) {
            const end = currentSelection.end();
            const backtrack = isInGalleryCurrent ? 0 : 2;
            tr.insert(end - backtrack, attachmentNodes);
          } else {
            const gallery = schema.nodes["attachment-gallery"].create(
              {},
              attachmentNodes
            );
            const currSelection = state.selection;

            tr.replaceWith(currSelection.from - 1, currSelection.to, [
              schema.nodes.paragraph.create(),
              gallery,
              schema.nodes.paragraph.create(),
            ]);
            selectionToInsertionEnd(tr, tr.steps.length - 1, -1);
          }

          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
