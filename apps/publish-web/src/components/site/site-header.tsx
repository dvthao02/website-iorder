import Link from "next/link";
import { getNavigation } from "@/lib/backend";
import type { NavigationItems } from "@iorder/core/server/navigation/navigation.contract";
import { getSiteProfile } from "@/lib/backend";
import { getMediaById } from "@/lib/backend";
import Image from "next/image";

// Header là phần dùng chung của website public. Nó chỉ chứa điều hướng,
// còn nội dung từng trang vẫn do Server Component đọc từ database.
export async function SiteHeader() {
  const [items, ctas, profile] = await Promise.all([getNavigation("header"), getNavigation("header_cta"), getSiteProfile()]);
  const logo = profile?.logoMediaId ? await getMediaById(profile.logoMediaId) : null;
  const cta = ctas?.find(item => item.isEnabled && item.parentKey === null);
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label={`${profile?.companyName ?? "iOrder"} - Trang chủ`}>
          {logo ? <Image src={logo.url} alt={profile?.companyName ?? "iOrder"} width={140} height={48} className="h-10 w-auto" /> : <><span className="brand__mark" aria-hidden="true">i</span>{profile?.companyName ?? "iOrder"}</>}
        </Link>
        <nav className="site-nav" aria-label="Điều hướng chính">
          <MenuBranch items={items ?? []} parentKey={null} />
        </nav>
        <details className="site-mobile-nav">
          <summary aria-label="Mở menu điều hướng">Menu</summary>
          <nav aria-label="Điều hướng chính trên thiết bị di động">
            <MenuBranch items={items ?? []} parentKey={null} />
          </nav>
        </details>
        {cta ? <Link className="header-cta" href={cta.url} target={cta.target} rel={cta.target === "_blank" ? "noopener noreferrer" : undefined}>{cta.label}</Link> : null}
      </div>
    </header>
  );
}

function MenuBranch({ items, parentKey, depth = 0 }: { items: NavigationItems; parentKey: string | null; depth?: number }) {
  const branchItems = items.filter(item => item.parentKey === parentKey && item.isEnabled);
  return <ul className={parentKey === null ? "site-nav__list" : `site-nav__submenu site-nav__submenu--depth-${depth}`}>
    {branchItems.map(item => {
      const hasChildren = items.some(child => child.parentKey === item.key && child.isEnabled);
      return <li className={hasChildren ? "site-nav__item site-nav__item--branch" : "site-nav__item"} key={item.key}>
        <Link className="site-nav__link" href={item.url} target={item.target} rel={item.target === "_blank" ? "noopener noreferrer" : undefined}>
          {item.label}{hasChildren ? <span aria-hidden="true" className="site-nav__caret">⌄</span> : null}
        </Link>
        {hasChildren ? <MenuBranch items={items} parentKey={item.key} depth={depth + 1} /> : null}
      </li>;
    })}
  </ul>;
}
