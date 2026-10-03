"use client";

import Link from "next/link";
import { FileSearch, LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SearchResult = { id: string; label: string; slug: string; type: string; href: string };

export function AdminGlobalSearch() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cachedResults = useRef(new Map<string, SearchResult[]>());

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;
    const cacheKey = trimmedQuery.toLocaleLowerCase("vi");
    const cached = cachedResults.current.get(cacheKey);
    if (cached) { setItems(cached); setIsLoading(false); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/tim-kiem?q=${encodeURIComponent(trimmedQuery)}`, { signal: controller.signal });
        const payload = await response.json();
        if (response.ok) {
          const nextItems = payload.items ?? [];
          cachedResults.current.set(cacheKey, nextItems);
          if (cachedResults.current.size > 20) cachedResults.current.delete(cachedResults.current.keys().next().value!);
          setItems(nextItems);
        }
        else setItems([]);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setItems([]);
      } finally { if (!controller.signal.aborted) setIsLoading(false); }
    }, 320);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [query]);

  function close() { setIsOpen(false); inputRef.current?.blur(); }
  const showResults = isOpen && query.trim().length >= 2;

  return <div className="admin-global-search">
    <Search aria-hidden="true" size={16} />
    <input aria-autocomplete="list" aria-controls="admin-global-search-results" aria-expanded={showResults} aria-label="Tìm nội dung CMS" autoComplete="off" onChange={(event) => { const nextQuery = event.target.value; setQuery(nextQuery); setIsOpen(true); if (nextQuery.trim().length < 2) { setItems([]); setIsLoading(false); } }} onFocus={() => setIsOpen(true)} onKeyDown={(event) => { if (event.key === "Escape") close(); }} placeholder="Tìm toàn CMS: tiêu đề, slug, URL, tệp…" ref={inputRef} role="combobox" value={query} />
    {isLoading ? <LoaderCircle aria-label="Đang tìm kiếm" className="admin-global-search__loading" size={16} /> : query ? <button aria-label="Xóa tìm kiếm" onClick={() => { setQuery(""); inputRef.current?.focus(); }} type="button"><X aria-hidden="true" size={15} /></button> : null}
    {showResults ? <div className="admin-global-search__results" id="admin-global-search-results" role="listbox">
      {items.length ? items.map((item) => <Link href={item.href} key={`${item.type}-${item.id}`} onClick={close} role="option"><FileSearch aria-hidden="true" size={16} /><span><strong>{item.label}</strong><small>{item.type} · {item.slug.startsWith("/") ? item.slug : `/${item.slug}`}</small></span></Link>) : !isLoading ? <p>Không tìm thấy nội dung, slug, URL hoặc tệp khớp với từ khóa này.</p> : null}
    </div> : null}
  </div>;
}
