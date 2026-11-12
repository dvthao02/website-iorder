import type { PostContentDocument } from "@iorder/shared/server/posts/posts.contract";
import { RichContent, RichTableOfContents } from "./rich-content";

// `tocClassName`: trang có mục lục cột phải thì ẩn mục lục đầu bài ở màn rộng (ví dụ "xl:hidden").
export function PostContent({ document, tocClassName = "" }: { document: PostContentDocument; tocClassName?: string }) {
  // Bài soạn bằng trình soạn mới: mục lục tự động + nội dung định dạng.
  if (document.version === 2) return <><RichTableOfContents className={tocClassName} doc={document.doc} /><RichContent doc={document.doc} /></>;
  return (
    <div className="grid gap-7 text-lg leading-8 text-slate-700">
      {document.blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return <p key={`${block.type}-${index}`}>{block.text}</p>;
        }

        return (
          <section className="rounded-2xl bg-slate-50 p-6" key={`${block.type}-${index}`}>
            <h2 className="mb-4 text-xl font-bold tracking-tight text-slate-950">{block.heading}</h2>
            <ul className="grid gap-3 pl-5 text-base leading-7 marker:text-brand-700">
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
