import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import {
  richPlainText, richTableOfContents, type BannerHeight, type BannerOverlay, type ImageAlign, type RichDocument, type RichMark, type RichNode,
} from "@iorder/core/server/shared/rich-text";

// Render nội dung soạn thảo bằng React (không chèn HTML thô). Dữ liệu đã được Backend làm sạch,
// ở đây chỉ dựng đúng các thành phần trong danh sách trắng.

function withMarks(text: ReactNode, marks: RichMark[] | undefined, key: string): ReactNode {
  return (marks ?? []).reduce<ReactNode>((child, mark, index) => {
    const markKey = `${key}-${index}`;
    switch (mark.type) {
      case "bold": return <strong key={markKey}>{child}</strong>;
      case "italic": return <em key={markKey}>{child}</em>;
      case "underline": return <u key={markKey}>{child}</u>;
      case "strike": return <s key={markKey}>{child}</s>;
      case "code": return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em]" key={markKey}>{child}</code>;
      case "link": {
        const external = /^https?:\/\//i.test(mark.attrs.href);
        return <a className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900" href={mark.attrs.href} key={markKey} {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}>{child}</a>;
      }
    }
  }, text);
}

// Độ rộng ảnh theo % khung bài. Ảnh chữ bao quanh (trái/phải) trên điện thoại rộng hết khung;
// ảnh "trên và dưới" giữ tỉ lệ nhưng không nhỏ hơn 60% để vẫn nhìn rõ.
const imageAlign: Record<ImageAlign, string> = {
  center: "mx-auto w-[max(var(--image-width),60%)] md:w-[var(--image-width)]",
  left: "w-full md:float-left md:mb-3 md:mr-6 md:w-[var(--image-width)]",
  right: "w-full md:float-right md:mb-3 md:ml-6 md:w-[var(--image-width)]",
};
const bannerOverlay: Record<BannerOverlay, { layer: string; text: string }> = {
  dark: { layer: "bg-slate-950/55", text: "text-white" },
  light: { layer: "bg-white/70", text: "text-slate-950" },
  none: { layer: "", text: "text-white [text-shadow:0_1px_4px_rgb(0_0_0/0.6)]" },
};
const bannerHeight: Record<BannerHeight, string> = { short: "min-h-48", medium: "min-h-72", tall: "min-h-[26rem]" };

function children(nodes: RichNode[] | undefined, key: string) {
  return (nodes ?? []).map((node, index) => <RichNodeView key={`${key}-${index}`} node={node} path={`${key}-${index}`} />);
}

function RichNodeView({ node, path, headingId }: { node: RichNode; path: string; headingId?: string }): ReactNode {
  switch (node.type) {
    case "text": return withMarks(node.text, node.marks, path);
    case "hardBreak": return <br />;
    case "paragraph": return <p>{children(node.content, path)}</p>;
    case "heading": {
      const className = node.attrs.level === 2 ? "clear-both pt-6 scroll-mt-24 text-2xl font-extrabold tracking-tight text-slate-950" : node.attrs.level === 3 ? "pt-2 scroll-mt-24 text-xl font-bold text-slate-950" : "text-lg font-bold text-slate-900";
      if (node.attrs.level === 2) return <h2 className={className} id={headingId}>{children(node.content, path)}</h2>;
      if (node.attrs.level === 3) return <h3 className={className} id={headingId}>{children(node.content, path)}</h3>;
      return <h4 className={className}>{children(node.content, path)}</h4>;
    }
    case "bulletList": return <ul className="grid list-disc gap-2 pl-6 marker:text-blue-700">{children(node.content, path)}</ul>;
    case "orderedList": return <ol className="grid list-decimal gap-2 pl-6 marker:font-bold marker:text-blue-700" start={node.attrs.start}>{children(node.content, path)}</ol>;
    case "listItem": return <li className="[&>p]:m-0">{children(node.content, path)}</li>;
    case "blockquote": return <blockquote className="border-l-4 border-blue-200 bg-slate-50 py-3 pl-5 pr-4 italic text-slate-600">{children(node.content, path)}</blockquote>;
    case "codeBlock": return <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm leading-6 text-slate-100"><code>{richPlainText({ type: "doc", content: node.content ?? [] })}</code></pre>;
    case "horizontalRule": return <hr className="clear-both border-slate-200" />;
    case "image": {
      const width = node.attrs.width ?? 100;
      const align = width >= 100 ? "center" : node.attrs.align ?? "center";
      return <figure className={`grid gap-2 ${imageAlign[align]}`} style={{ "--image-width": `${width}%` } as CSSProperties}><Image alt={node.attrs.alt ?? ""} className="h-auto w-full rounded-xl" height={800} sizes={`(min-width: 768px) ${Math.ceil(7.6 * width)}px, 100vw`} src={node.attrs.src} width={1200} />{node.attrs.title ? <figcaption className="text-center text-sm text-slate-500">{node.attrs.title}</figcaption> : null}</figure>;
    }
    case "imageBanner": {
      const overlay = bannerOverlay[node.attrs.overlay] ?? bannerOverlay.dark;
      return <section className={`relative isolate clear-both grid content-center gap-3 overflow-hidden rounded-2xl bg-slate-700 px-6 py-10 text-center md:px-12 ${bannerHeight[node.attrs.height] ?? bannerHeight.medium} ${overlay.text} [&>*]:m-0 [&>*]:pt-0! [&_:is(h2,h3,h4)]:text-current [&_h2]:text-3xl md:[&_h2]:text-4xl [&_blockquote]:border-current [&_blockquote]:bg-transparent [&_blockquote]:text-current`}>
        <Image alt="" className="-z-20 object-cover" fill sizes="(min-width: 768px) 760px, 100vw" src={node.attrs.src} />
        {overlay.layer ? <span aria-hidden className={`absolute inset-0 -z-10 ${overlay.layer}`} /> : null}
        {children(node.content, path)}
      </section>;
    }
    case "table": return <div className="clear-both overflow-x-auto rounded-xl border border-slate-200"><table className="w-full border-collapse text-left text-base"><tbody>{children(node.content, path)}</tbody></table></div>;
    case "tableRow": return <tr className="border-b border-slate-200 last:border-0">{children(node.content, path)}</tr>;
    case "tableHeader": return <th className="bg-slate-50 px-4 py-3 align-top font-bold text-slate-900 [&>p]:m-0" colSpan={node.attrs.colspan} rowSpan={node.attrs.rowspan}>{children(node.content, path)}</th>;
    case "tableCell": return <td className="px-4 py-3 align-top [&>p]:m-0" colSpan={node.attrs.colspan} rowSpan={node.attrs.rowspan}>{children(node.content, path)}</td>;
  }
}

/** Mục lục từ tiêu đề H2/H3; chỉ hiện khi bài có từ 2 mục trở lên. */
export function RichTableOfContents({ doc }: { doc: RichDocument }) {
  const entries = richTableOfContents(doc);
  if (entries.length < 2) return null;
  return <nav aria-label="Mục lục bài viết" className="mb-10 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-base">
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.14em] text-slate-500">Nội dung bài viết</p>
    <ol className="grid gap-2">{entries.map((entry) => <li className={entry.level === 3 ? "pl-5 text-slate-600" : "font-semibold text-slate-800"} key={entry.id}><a className="hover:text-blue-700 hover:underline" href={`#${entry.id}`}>{entry.text}</a></li>)}</ol>
  </nav>;
}

export function RichContent({ doc }: { doc: RichDocument }) {
  // Id của H2/H3 cấp đầu khớp đúng thứ tự mục lục.
  const ids = richTableOfContents(doc).map((entry) => entry.id);
  let headingIndex = 0;
  // flow-root (không dùng grid) để ảnh căn trái/phải cho chữ chạy quanh.
  return <div className="flow-root text-lg leading-8 text-slate-700 [&>*+*]:mt-5">
    {doc.content.map((node, index) => {
      const id = node.type === "heading" && node.attrs.level <= 3 && richPlainText({ type: "doc", content: [node] }) ? ids[headingIndex++] : undefined;
      return <RichNodeView headingId={id} key={`n-${index}`} node={node} path={`n-${index}`} />;
    })}
  </div>;
}
