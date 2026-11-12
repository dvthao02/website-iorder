"use client";
import { readAdminJson } from "@/lib/admin-api";

import Link from "next/link";
import { FileSearch, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

const searchResponseSchema = z.object({ items: z.array(z.object({
  id: z.string(), label: z.string(), slug: z.string(), type: z.string(),
  href: z.string().regex(/^\/admin(?:[/?]|$)/).refine((href) => !/[\\\u0000-\u0020]/.test(href)),
})) });
type SearchResult = z.infer<typeof searchResponseSchema>["items"][number];
type SearchState = { query: string; items: SearchResult[]; status: "ready" | "error" };

export function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const trimmedQuery = query.trim();
  const isLoading = trimmedQuery.length >= 2 && result?.query !== trimmedQuery;
  const items = result?.query === trimmedQuery && result.status === "ready" ? result.items : [];
  const failed = result?.query === trimmedQuery && result.status === "error";
  const showResults = isOpen && trimmedQuery.length >= 2;

  useEffect(() => {
    if (trimmedQuery.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/tim-kiem?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal });
        const payload: unknown = await readAdminJson(response);
        const parsed = searchResponseSchema.safeParse(payload);
        if (!response.ok || !parsed.success) throw new Error("Không tải được kết quả tìm kiếm.");
        if (!controller.signal.aborted) setResult({ query: trimmedQuery, items: parsed.data.items, status: "ready" });
      } catch {
        if (!controller.signal.aborted) setResult({ query: trimmedQuery, items: [], status: "error" });
      }
    }, 320);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [trimmedQuery, retry]);

  function close() { setIsOpen(false); setActiveIndex(-1); }
  function moveTo(index: number) {
    setActiveIndex(index);
    optionRefs.current[index]?.scrollIntoView({ block: "nearest" });
  }

  return <div className="admin-global-search" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) close();
  }}>
    <Search aria-hidden="true" size={16} />
    <input aria-activedescendant={showResults && items[activeIndex] ? `admin-search-option-${activeIndex}` : undefined} aria-autocomplete="list" aria-controls={showResults ? "admin-global-search-results" : undefined} aria-expanded={showResults} aria-label="Tìm nội dung CMS" autoComplete="off" maxLength={120} onChange={(event) => {
      if (event.target.value.trim() !== trimmedQuery) setResult(null);
      setQuery(event.target.value); setActiveIndex(-1); setIsOpen(true);
    }} onFocus={() => setIsOpen(true)} onKeyDown={(event) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && items.length) {
        event.preventDefault(); setIsOpen(true);
        moveTo(event.key === "ArrowDown" ? (activeIndex + 1) % items.length : (activeIndex < 0 ? items.length - 1 : (activeIndex - 1 + items.length) % items.length));
      } else if (event.key === "Enter" && showResults && items[activeIndex]) {
        event.preventDefault(); optionRefs.current[activeIndex]?.click();
      }
    }} placeholder="Tìm toàn CMS: tiêu đề, slug, URL, tệp…" ref={inputRef} role="combobox" value={query} />
    {isLoading ? <LoaderCircle aria-hidden="true" className="admin-global-search__loading" size={16} /> : null}
    {query ? <button aria-label="Xóa tìm kiếm" onClick={() => { setQuery(""); setResult(null); setActiveIndex(-1); inputRef.current?.focus(); }} type="button"><X aria-hidden="true" size={15} /></button> : null}
    {showResults ? <div className="admin-global-search__results">
      <div aria-label="Kết quả tìm kiếm CMS" aria-busy={isLoading} id="admin-global-search-results" role="listbox">
        {items.map((item, index) => <Link aria-selected={index === activeIndex} href={item.href} id={`admin-search-option-${index}`} key={`${item.type}-${item.id}`} onClick={close} onMouseEnter={() => setActiveIndex(index)} ref={(element) => { optionRefs.current[index] = element; }} role="option" tabIndex={-1}><FileSearch aria-hidden="true" size={16} /><span><strong>{item.label}</strong><small>{item.type} · {item.slug.startsWith("/") ? item.slug : `/${item.slug}`}</small></span></Link>)}
      </div>
      <p role="status">{isLoading ? "Đang tìm kiếm…" : failed ? "Không tải được kết quả. Vui lòng thử lại." : items.length ? `${items.length} kết quả. Dùng phím lên, xuống để chọn và Enter để mở.` : "Không có nội dung khớp với từ khóa này. Thử từ khóa khác."}</p>
      {failed ? <button className="admin-button admin-button--secondary admin-button--sm" onClick={() => { setResult(null); setActiveIndex(-1); setRetry((value) => value + 1); inputRef.current?.focus(); }} type="button">Thử lại tìm kiếm</button> : null}
    </div> : null}
  </div>;
}
