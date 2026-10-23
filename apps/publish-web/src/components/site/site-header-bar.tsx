"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

export type HeaderLink = { key: string; label: string; url: string; target: "_self" | "_blank"; children: HeaderLink[] };

const external = (link: HeaderLink) => link.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {};
function matches(pathname: string, url: string) {
  const path = url.split("#")[0].split("?")[0];
  if (!path.startsWith("/")) return false;
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
const isActive = (pathname: string, link: HeaderLink): boolean => matches(pathname, link.url) || link.children.some((child) => isActive(pathname, child));

// Đầu trang: dính trên cùng, có bóng khi cuộn. Máy tính: menu ngang, mục có con mở bảng thả xuống
// (nhiều mục thì chia 2 cột). Điện thoại: nút ☰ mở bảng menu toàn chiều ngang, mục có con gập/mở.
export function SiteHeaderBar({ actions, brand, links, logo }: { actions: HeaderLink[]; brand: string; links: HeaderLink[]; logo: { url: string; alt: string } | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Menu điện thoại gắn với đường dẫn lúc mở: chuyển trang là tự đóng.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const mobileOpen = openOn === pathname;
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  // Khi mở menu điện thoại: khóa cuộn nền, Esc để đóng.
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpenOn(null); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [mobileOpen]);

  // Bảng menu điện thoại nằm ngoài <header>: header có backdrop-filter nên phần tử fixed bên trong sẽ bị định vị theo header.
  return <><header className={scrolled || mobileOpen ? "site-header site-header--scrolled" : "site-header"}>
    <div className="site-header__inner">
      <Link aria-label={`${brand} - Trang chủ`} className="brand" href="/">
        {logo ? <Image alt={logo.alt} className="h-[38px] w-auto" height={80} priority src={logo.url} width={200} /> : <><span aria-hidden="true" className="brand__mark">i</span>{brand}</>}
      </Link>

      <nav aria-label="Điều hướng chính" className="site-nav">
        <ul className="site-nav__list">{links.map((link) => {
          const active = isActive(pathname, link);
          if (!link.children.length) return <li className="site-nav__item" key={link.key}><Link aria-current={matches(pathname, link.url) ? "page" : undefined} className={active ? "site-nav__link site-nav__link--active" : "site-nav__link"} href={link.url} {...external(link)}>{link.label}</Link></li>;
          return <li className="site-nav__item site-nav__item--branch" key={link.key}>
            <Link aria-haspopup="true" className={active ? "site-nav__link site-nav__link--active" : "site-nav__link"} href={link.url} {...external(link)}>{link.label}<ChevronDown aria-hidden="true" className="site-nav__caret" size={16} /></Link>
            <ul className={link.children.length > 4 ? "site-nav__dropdown site-nav__dropdown--wide" : "site-nav__dropdown"}>{link.children.map((child) => <li key={child.key}><Link aria-current={matches(pathname, child.url) ? "page" : undefined} className="site-nav__dropdown-link" href={child.url} {...external(child)}>{child.label}</Link></li>)}</ul>
          </li>;
        })}</ul>
      </nav>

      <div className="site-header__actions">
        {actions.map((action, index) => <Link className={index === actions.length - 1 ? "header-cta header-cta--primary" : "header-cta header-cta--secondary"} href={action.url} key={action.key} {...external(action)}>{action.label}</Link>)}
        <button aria-controls="site-mobile-menu" aria-expanded={mobileOpen} aria-label={mobileOpen ? "Đóng menu" : "Mở menu"} className="site-menu-toggle" onClick={() => { setExpanded(null); setOpenOn(mobileOpen ? null : pathname); }} type="button">{mobileOpen ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}</button>
      </div>
    </div>
  </header>

    <div className={mobileOpen ? "site-mobile-menu site-mobile-menu--open" : "site-mobile-menu"} hidden={!mobileOpen} id="site-mobile-menu">
      <nav aria-label="Điều hướng chính trên điện thoại">
        <ul className="site-mobile-menu__list">{links.map((link) => <li key={link.key}>
          {link.children.length ? <>
            <button aria-expanded={expanded === link.key} className={isActive(pathname, link) ? "site-mobile-menu__link site-mobile-menu__link--active" : "site-mobile-menu__link"} onClick={() => setExpanded((current) => current === link.key ? null : link.key)} type="button">{link.label}<ChevronDown aria-hidden="true" className={expanded === link.key ? "rotate-180 transition" : "transition"} size={18} /></button>
            {expanded === link.key ? <ul className="site-mobile-menu__children">
              <li><Link className="site-mobile-menu__child" href={link.url} {...external(link)}>Xem tất cả {link.label.toLocaleLowerCase("vi")}</Link></li>
              {link.children.map((child) => <li key={child.key}><Link className="site-mobile-menu__child" href={child.url} {...external(child)}>{child.label}</Link></li>)}
            </ul> : null}
          </> : <Link className={isActive(pathname, link) ? "site-mobile-menu__link site-mobile-menu__link--active" : "site-mobile-menu__link"} href={link.url} {...external(link)}>{link.label}</Link>}
        </li>)}</ul>
        {actions.length ? <div className="site-mobile-menu__actions">{actions.map((action, index) => <Link className={`button ${index === actions.length - 1 ? "button--primary" : "button--secondary"}`} href={action.url} key={action.key} {...external(action)}>{action.label}</Link>)}</div> : null}
      </nav>
    </div>
  </>;
}
