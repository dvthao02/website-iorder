"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, ExternalLink, FileText, X } from "lucide-react";
import Image from "next/image";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useT } from "./messages-provider";
import { SiteLink } from "./site-link";

export type DocumentCard = {
  title: string;
  /** Dòng ngắn dưới tiêu đề, ví dụ "Xem giấy chứng nhận". */
  caption: string | null;
  /** Có đường dẫn (ví dụ tệp PDF) thì bấm thẻ là đi tới đó; không có thì mở ảnh lớn ngay trên trang. */
  href: string | null;
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
};

const isExternal = (href: string) => /^(https?:)?\/\//i.test(href);
// Khổ A4 dọc khi tệp chưa ghi kích thước ảnh; chỉ dùng để giữ tỉ lệ trước khi ảnh tải xong.
const fallbackSize = { width: 1240, height: 1754 };

function CardFace({ card, eager }: { card: DocumentCard; eager: boolean }) {
  return <>
    <span className="document-card__frame">
      {card.image
        ? <span className="document-card__sheet"><Image alt={card.image.alt} className="document-card__image" fill loading={eager ? "eager" : undefined} sizes="(min-width: 1280px) 16vw, (min-width: 640px) 28vw, 44vw" src={card.image.url} /></span>
        : <span aria-hidden="true" className="document-card__empty"><FileText size={40} strokeWidth={1.4} /></span>}
    </span>
    <span className="document-card__meta">
      <strong data-builder-field="title">{card.title}</strong>
      <ArrowUpRight aria-hidden="true" size={18} />
    </span>
    {card.caption ? <span className="document-card__caption" data-builder-field="description">{card.caption}</span> : null}
  </>;
}

// "Giấy tờ, chứng nhận": lưới thẻ có ảnh bản chụp trong khung nhạt; bấm thẻ mở ảnh lớn trong hộp thoại (Esc, bấm nền hoặc nút Đóng để thoát,
// mũi tên trái/phải chuyển giữa các giấy tờ). Thẻ có đường dẫn thì là liên kết thường, không mở hộp thoại.
export function DocumentGrid({ cards, eager = false }: { cards: DocumentCard[]; eager?: boolean }) {
  const t = useT();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<number | null>(null);
  // Giấy tờ xem được trong hộp thoại: có ảnh và không phải liên kết.
  const viewable = useMemo(() => cards.flatMap((card, index) => card.image && !card.href ? [index] : []), [cards]);
  const position = current === null ? -1 : viewable.indexOf(current);
  const card = current === null ? null : cards[current];

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (current !== null && !element.open) element.showModal();
    if (current === null && element.open) element.close();
  }, [current]);
  useEffect(() => {
    if (current === null) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [current]);

  const close = useCallback(() => setCurrent(null), []);
  const step = useCallback((direction: 1 | -1) => {
    if (viewable.length < 2 || position < 0) return;
    setCurrent(viewable[(position + direction + viewable.length) % viewable.length]);
  }, [position, viewable]);

  return <>
    <ul className="document-grid">
      {cards.map((item, index) => {
        const face = <CardFace card={item} eager={eager && index < 5} />;
        const label = t("documents.view", { name: item.title });
        let content;
        if (item.href) {
          content = isExternal(item.href)
            ? <a className="document-card__open" data-builder-field="href" href={item.href} rel="noopener noreferrer" target="_blank">{face}</a>
            : <SiteLink className="document-card__open" data-builder-field="href" href={item.href}>{face}</SiteLink>;
        } else if (item.image) {
          content = <button aria-haspopup="dialog" aria-label={label} className="document-card__open" onClick={() => setCurrent(index)} type="button">{face}</button>;
        } else {
          content = <div className="document-card__open document-card__open--static">{face}</div>;
        }
        return <li className="document-card" data-builder-item={`items:${index}`} key={`${item.title}-${index}`}>{content}</li>;
      })}
    </ul>
    <dialog aria-labelledby={titleId} className="document-viewer" onClick={event => { if (event.target === event.currentTarget) close(); }} onClose={close} onKeyDown={event => { if (event.key === "ArrowLeft") step(-1); if (event.key === "ArrowRight") step(1); }} ref={dialog}>
      {card?.image ? <div className="document-viewer__panel">
        <div className="document-viewer__bar">
          <p className="document-viewer__title" id={titleId}>{card.title}</p>
          {viewable.length > 1 ? <span aria-live="polite" className="document-viewer__count">{t("documents.counter", { current: position + 1, total: viewable.length })}</span> : null}
          <a className="document-viewer__button" href={card.image.url} rel="noopener noreferrer" target="_blank"><ExternalLink aria-hidden="true" size={16} />{t("documents.openOriginal")}</a>
          <button aria-label={t("documents.close")} className="document-viewer__button document-viewer__button--icon" onClick={close} type="button"><X aria-hidden="true" size={18} /></button>
        </div>
        <div className="document-viewer__stage">
          <Image alt={card.image.alt} className="document-viewer__image" height={card.image.height ?? fallbackSize.height} sizes="(min-width: 1024px) 640px, 96vw" src={card.image.url} width={card.image.width ?? fallbackSize.width} />
          {viewable.length > 1 ? <>
            <button aria-label={t("documents.previous")} className="document-viewer__nav document-viewer__nav--previous" onClick={() => step(-1)} type="button"><ChevronLeft aria-hidden="true" size={22} /></button>
            <button aria-label={t("documents.next")} className="document-viewer__nav document-viewer__nav--next" onClick={() => step(1)} type="button"><ChevronRight aria-hidden="true" size={22} /></button>
          </> : null}
        </div>
      </div> : null}
    </dialog>
  </>;
}
