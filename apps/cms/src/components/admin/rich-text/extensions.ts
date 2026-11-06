import Image from "@tiptap/extension-image";
import type { DOMOutputSpec } from "@tiptap/pm/model";
import { mergeAttributes, Node, ReactNodeViewRenderer } from "@tiptap/react";

import { imageWidthLimits, videoWidthLimits, type BannerHeight, type BannerOverlay, type ImageAlign } from "@iorder/core/server/shared/rich-text";
import { isYoutubeVideoId, youtubeThumbnailUrl, youtubeVideoId } from "@iorder/core/server/shared/youtube";
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

const clampVideoWidth = (value: unknown) => Math.min(videoWidthLimits.max, Math.max(videoWidthLimits.min, Math.round(Number(value) || 100)));

// Video YouTube trong bài: một khối nguyên (không gõ chữ bên trong). Trình soạn hiện ảnh xem trước của video
// (iframe trong vùng soạn thảo sẽ "nuốt" cú bấm nên không chọn được khối); website nhúng khung phát thật.
// Dán HTML có iframe YouTube (từ trang khác) cũng thành khối video.
export const YouTubeVideo = Node.create({
  name: "youtube",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      videoId: { default: null, parseHTML: (element) => element.getAttribute("data-video-id"), renderHTML: () => ({}) },
      caption: { default: null, parseHTML: (element) => element.getAttribute("data-caption") || null, renderHTML: () => ({}) },
      width: { default: 100, parseHTML: (element) => clampVideoWidth(element.getAttribute("data-width")), renderHTML: () => ({}) },
    };
  },
  parseHTML() {
    return [
      { tag: "div[data-youtube]", getAttrs: (element) => isYoutubeVideoId(element.getAttribute("data-video-id")) ? null : false },
      { tag: "iframe[src]", getAttrs: (element) => { const videoId = youtubeVideoId(element.getAttribute("src") ?? ""); return videoId ? { videoId } : false; } },
    ];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { videoId, caption, width } = node.attrs as { videoId: string; caption: string | null; width: number };
    const children: DOMOutputSpec[] = [
      ["span", { class: "admin-rte-video__frame" }, ["img", { alt: "", draggable: "false", src: youtubeThumbnailUrl(videoId) }], ["span", { "aria-hidden": "true", class: "admin-rte-video__play" }]],
    ];
    if (caption) children.push(["span", { class: "admin-rte-video__caption" }, caption]);
    return ["div", mergeAttributes(HTMLAttributes, {
      "data-youtube": "",
      "data-video-id": videoId,
      "data-caption": caption ?? "",
      "data-width": width,
      class: "admin-rte-video",
      style: `--video-width: ${clampVideoWidth(width)}%`,
    }), ...children];
  },
});

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
