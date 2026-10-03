import type { OfferingContent } from "@iorder/core/server/offerings/offering-content.contract";

export function OfferingContent({ content }: { content: OfferingContent }) {
  return (
    <div className="grid gap-12">
      <section className="grid gap-5 text-lg leading-8 text-slate-700">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">Tổng quan</h2>
        <p>{content.description}</p>
      </section>

      {content.features.length > 0 ? <OfferingList title="Tính năng chính" items={content.features} /> : null}
      {content.benefits.length > 0 ? <OfferingList title="Lợi ích mang lại" items={content.benefits} /> : null}
      {content.items.length > 0 ? <section><h2 className="mb-4 text-2xl font-bold">Nội dung liên quan</h2><ul>{content.items.map((item, index) => <li key={index}>{typeof item === "string" ? item : <a className="text-blue-700" href={item.href}>{item.title}</a>}</li>)}</ul></section> : null}

      {content.faq.length > 0 ? (
        <section>
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight text-slate-950">Câu hỏi thường gặp</h2>
          <div className="grid gap-3">
            {content.faq.map(([question, answer]) => (
              <details className="rounded-2xl border border-slate-200 bg-white p-5" key={question}>
                <summary className="cursor-pointer font-bold text-slate-900">{question}</summary>
                <p className="mt-4 leading-7 text-slate-600">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function OfferingList({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="mb-5 text-2xl font-extrabold tracking-tight text-slate-950">{title}</h2>
      <ul className="grid gap-3 pl-5 text-lg leading-7 text-slate-700 marker:text-blue-700">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </section>
  );
}
