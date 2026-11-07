"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import { useId, useState } from "react";

import { SiteLink as Link } from "./site-link";

export type SupportSearchItem = { title: string; href: string; kind: string; text?: string | null };

// So khớp không dấu, không phân biệt hoa thường: gõ "in hoa don" vẫn ra "In hóa đơn".
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/**
 * Ô tìm nhanh của Trung tâm hỗ trợ: lọc ngay trên trình duyệt trong hướng dẫn, tệp cài đặt và câu hỏi thường gặp
 * (dữ liệu từ CMS truyền xuống). Mọi từ gõ vào phải có trong tiêu đề hoặc mô tả; tiêu đề khớp được xếp trước.
 * Enter mở kết quả đầu tiên; các gợi ý nhanh bên dưới điền sẵn từ khóa.
 */
export function SupportSearch({ items, suggestions }: { items: SupportSearchItem[]; suggestions: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const resultsId = useId();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const results = words.length ? items
    .map((item) => { const title = fold(item.title); const all = `${title} ${fold(item.text ?? "")}`; return words.every((word) => all.includes(word)) ? { item, score: words.filter((word) => title.includes(word)).length } : null; })
    .filter((entry): entry is { item: SupportSearchItem; score: number } => entry !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => entry.item) : [];

  return <div className="support-search">
    <form onSubmit={(event) => { event.preventDefault(); if (results[0]) router.push(results[0].href); }} role="search">
      <label className="sr-only" htmlFor={`${resultsId}-input`}>Tìm trong trung tâm hỗ trợ</label>
      <div className="support-search__box">
        <Search aria-hidden="true" className="shrink-0 text-muted" size={22} />
        <input aria-controls={resultsId} autoComplete="off" className="support-search__input" id={`${resultsId}-input`} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm hướng dẫn: kết ca, in hóa đơn, kho hàng…" type="search" value={query} />
        {query ? <button aria-label="Xóa từ khóa" className="support-search__clear" onClick={() => setQuery("")} type="button"><X aria-hidden="true" size={18} /></button> : null}
      </div>
    </form>
    <div id={resultsId}>
      <p aria-live="polite" className="sr-only">{words.length ? `${results.length} kết quả` : ""}</p>
      {words.length ? <div className="support-search__results">
        {results.length ? <ul className="m-0 list-none p-0">{results.map((item) => <li key={item.href}>
          <Link className="support-search__result" href={item.href}>
            <span className="support-search__kind">{item.kind}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{item.title}</span>
            <ArrowRight aria-hidden="true" className="shrink-0 text-brand-600" size={18} />
          </Link>
        </li>)}</ul> : <p className="m-0 px-5 py-4 text-body text-muted">Chưa tìm thấy nội dung phù hợp. Thử từ khóa khác, hoặc gọi hotline để được hỗ trợ trực tiếp.</p>}
      </div> : null}
    </div>
    {suggestions.length ? <div className="mt-4 flex flex-wrap items-center gap-2 text-small">
      <span className="text-muted">Tìm nhiều:</span>
      {suggestions.map((suggestion) => <button className="support-search__chip" key={suggestion} onClick={() => setQuery(suggestion)} type="button">{suggestion}</button>)}
    </div> : null}
  </div>;
}
