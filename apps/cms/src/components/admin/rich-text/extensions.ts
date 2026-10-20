import Image from "@tiptap/extension-image";
import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";

import { imageWidthLimits, type BannerHeight, type BannerOverlay, type ImageAlign } from "@iorder/core/server/shared/rich-text";
import { ImageView } from "./image-view";

const legacyWidths: Record<string, number> = { small: 33, medium: 50, large: 75, full: 100 };

// Độ rộng % từ HTML dán/nhập: data-width, style="width: 40%", hoặc data-size cũ; còn lại là toàn khổ.
function parseWidth(element: HTMLElement) {
  const raw = Number(element.getAttribute("data-width")) || Number(/^\s*(\d+(?:\.\d+)?)%\s*$/.exec(element.style.width)?.[1]) || legacyWidths[element.getAttribute("data-size") ?? ""] || 100;
  return Math.min(imageWidthLimits.max, Math.max(imageWidthLimits.min, Math.round(raw)));
}

// Ảnh trong bài: độ rộng theo % khung bài (kéo góc ảnh để đổi) và kiểu ngắt dòng như Word.
// Lưu bằng data-* để HTML dán/nhập vẫn giữ được; website đọc thẳng từ JSON.
export const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: 100, parseHTML: parseWidth, renderHTML: (attributes) => ({ "data-width": attributes.width }) },
      height: { default: null, parseHTML: () => null, renderHTML: () => ({}) },
      align: {
        default: "center" satisfies ImageAlign,
        parseHTML: (element) => element.getAttribute("data-align") ?? "center",
        renderHTML: (attributes) => ({ "data-align": attributes.align }),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
}).configure({ allowBase64: false });

// Khối ảnh nền: ảnh phủ kín bề ngang, bên trong là tiêu đề/đoạn văn đè lên ảnh.
export const ImageBanner = Node.create({
  name: "imageBanner",
  group: "block",
  content: "(paragraph | heading | bulletList | orderedList | blockquote)+",
  defining: true,
  isolating: true,
  addAttributes() {
    return {
      src: { default: null, parseHTML: (element) => element.getAttribute("data-src"), renderHTML: () => ({}) },
      overlay: { default: "dark" satisfies BannerOverlay, parseHTML: (element) => element.getAttribute("data-overlay") ?? "dark", renderHTML: () => ({}) },
      height: { default: "medium" satisfies BannerHeight, parseHTML: (element) => element.getAttribute("data-height") ?? "medium", renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [{ tag: "section[data-image-banner]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { src, overlay, height } = node.attrs as { src: string | null; overlay: string; height: string };
    return ["section", mergeAttributes(HTMLAttributes, {
      "data-image-banner": "",
      "data-src": src ?? "",
      "data-overlay": overlay,
      "data-height": height,
      class: `admin-rte-banner admin-rte-banner--${overlay} admin-rte-banner--${height}`,
      style: src ? `background-image: url("${src}")` : "",
    }), 0];
  },
});
