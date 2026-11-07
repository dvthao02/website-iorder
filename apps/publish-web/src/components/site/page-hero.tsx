import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/site/json-ld";
import { SiteLink as Link } from "@/components/site/site-link";
import { Container } from "@/components/ui";
import { getPublishingConfig } from "@/lib/backend";
import { breadcrumbJsonLd } from "@/lib/structured-data";

export type Crumb = { name: string; path: string };

/** Dữ liệu cấu trúc breadcrumb (Trang chủ › …) cho Google; không hiện gì trên trang. Cần URL website trong Cài đặt. */
export async function BreadcrumbJsonLd({ crumbs }: { crumbs: Crumb[] }) {
  const site = (await getPublishingConfig()).siteUrl;
  return site ? <JsonLd data={[breadcrumbJsonLd(site, [{ name: "Trang chủ", path: "/" }, ...crumbs])]} /> : null;
}

// Phần đầu trang con (trang danh sách, chuyên mục, thẻ…): đường dẫn "Trang chủ › … › trang này" (kèm dữ liệu cấu trúc),
// nhãn, tiêu đề căn trái cỡ vừa, mô tả — trên dải nền riêng có viền dưới. Trang để tra cứu nên tiêu đề không to như trang chủ.
// `crumbs`: các cấp sau Trang chủ, cấp cuối là trang hiện tại (tên ngắn); `children`: phần thêm dưới mô tả (thanh chuyển phần…).
export async function PageHero({ crumbs, eyebrow, title, description, children }: { crumbs: Crumb[]; eyebrow?: string | null; title: string; description?: string | null; children?: ReactNode }) {
  const trail = crumbs.slice(0, -1);
  const current = crumbs.at(-1);
  return <header className="listing-hero">
    <BreadcrumbJsonLd crumbs={crumbs} />
    <Container className="py-8 sm:py-11">
      <nav aria-label="Đường dẫn">
        <ol className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0 text-small text-muted">
          <li><Link className="transition hover:text-brand-700" href="/">Trang chủ</Link></li>
          {trail.map((crumb) => <li className="flex items-center gap-1.5" key={crumb.path}>
            <ChevronRight aria-hidden="true" size={14} />
            <Link className="transition hover:text-brand-700" href={crumb.path}>{crumb.name}</Link>
          </li>)}
          {current ? <li className="flex items-center gap-1.5"><ChevronRight aria-hidden="true" size={14} /><span aria-current="page" className="font-semibold text-ink">{current.name}</span></li> : null}
        </ol>
      </nav>
      <div className="mt-5 max-w-3xl sm:mt-6">
        {eyebrow ? <p className="mb-3 inline-flex w-fit items-center rounded-full bg-brand-50 px-3 py-1 text-small font-semibold text-brand-700">{eyebrow}</p> : null}
        <h1 className="mb-0 text-[2rem] leading-[1.15] font-bold tracking-tight text-balance text-ink sm:text-[2.5rem] xl:text-[2.75rem]">{title}</h1>
        {description ? <p className="mt-3 mb-0 text-lead whitespace-pre-line text-muted">{description}</p> : null}
      </div>
      {children}
    </Container>
  </header>;
}
