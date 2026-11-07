"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; text: string; level: 2 | 3 };

/**
 * Mục lục bám theo khi cuộn (cột phải của bài viết, bài hướng dẫn): mục đang đọc được tô đậm — là tiêu đề cuối cùng
 * đã cuộn qua mép trên (dưới header). Bấm mục thì nhảy tới tiêu đề (neo #id, có chừa chỗ cho header).
 */
export function ArticleToc({ entries }: { entries: Entry[] }) {
  const [active, setActive] = useState(entries[0]?.id ?? "");
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = entries[0]?.id ?? "";
      for (const entry of entries) {
        const element = document.getElementById(entry.id);
        if (element && element.getBoundingClientRect().top <= 140) current = entry.id;
      }
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, [entries]);

  return <nav aria-label="Mục lục bài viết" className="article-toc">
    <p className="article-toc__title">Trong bài này</p>
    <ol>{entries.map((entry) => <li data-level={entry.level} key={entry.id}>
      <a aria-current={entry.id === active ? "location" : undefined} href={`#${entry.id}`}>{entry.text}</a>
    </li>)}</ol>
  </nav>;
}
