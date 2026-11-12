import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import type { GuideGroup } from "@/lib/guides";
import { SiteLink as Link } from "./site-link";
import { SlidingRail } from "./sliding-rail";

/**
 * Danh mục hướng dẫn: mỗi nhóm (chuyên mục) gập/mở được; bài đang xem có thanh trượt "|" bên trái (SlidingRail),
 * thanh trượt theo bài đang rê chuột rồi quay về bài đang xem.
 * Nhóm chứa bài đang xem mở sẵn; ở trang tổng hợp (không có bài đang xem) mọi nhóm đều mở.
 */
function GuideNav({ groups, activeHref }: { groups: GuideGroup[]; activeHref?: string }) {
  return <nav aria-label="Danh mục hướng dẫn" className="guide-nav"><SlidingRail className="guide-nav__rail">
    {groups.map((group) => {
      const open = !activeHref || groups.length === 1 || group.items.some((item) => item.href === activeHref);
      return <details className="guide-nav__group" key={group.key} open={open}>
        <summary>{group.label}<ChevronDown aria-hidden="true" size={16} /></summary>
        <ul>{group.items.map((item) => <li key={item.href}><Link aria-current={item.href === activeHref ? "page" : undefined} className="guide-nav__link" href={item.href}>{item.title}</Link></li>)}</ul>
      </details>;
    })}
  </SlidingRail></nav>;
}

/**
 * Khung tài liệu hướng dẫn (kiểu trung tâm trợ giúp): danh mục bên trái, nội dung ở giữa, mục lục bên phải (nếu có).
 * Hai cột bên bám theo khi cuộn. Dưới 1024px danh mục thành hộp "Danh mục hướng dẫn" gập ở đầu nội dung;
 * dưới 1280px mục lục phải ẩn (bài tự hiện mục lục ngay đầu nội dung).
 */
export function GuideDocsLayout({ groups, activeHref, toc = null, children }: { groups: GuideGroup[]; activeHref?: string; toc?: ReactNode; children: ReactNode }) {
  return <div className="guide-docs">
    <div className={`site-container guide-docs__grid${toc ? " guide-docs__grid--toc" : ""}`}>
      <aside className="guide-docs__side"><div className="guide-docs__sticky"><GuideNav activeHref={activeHref} groups={groups} /></div></aside>
      <div className="min-w-0">
        <details className="guide-docs__mobile-nav"><summary>Danh mục hướng dẫn<ChevronDown aria-hidden="true" size={18} /></summary><GuideNav activeHref={activeHref} groups={groups} /></details>
        {children}
      </div>
      {toc ? <aside className="guide-docs__toc"><div className="guide-docs__sticky">{toc}</div></aside> : null}
    </div>
  </div>;
}
