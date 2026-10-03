import type { PostContentDocument } from "@iorder/core/server/posts/posts.contract";

export function PostContent({ document }: { document: PostContentDocument }) {
  return (
    <div className="grid gap-7 text-lg leading-8 text-slate-700">
      {document.blocks.map((block, index) => {
        if (block.type === "paragraph") {
          return <p key={`${block.type}-${index}`}>{block.text}</p>;
        }

        return (
          <section className="rounded-2xl bg-slate-50 p-6" key={`${block.type}-${index}`}>
            <h2 className="mb-4 text-xl font-extrabold tracking-tight text-slate-950">{block.heading}</h2>
            <ul className="grid gap-3 pl-5 text-base leading-7 marker:text-blue-700">
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
