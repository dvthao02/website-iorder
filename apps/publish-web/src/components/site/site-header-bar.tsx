"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Building2, ChevronDown, Compass, CodeXml, Menu, MonitorSmartphone, Network, Newspaper, Package, Phone, ReceiptText, Server, ShieldCheck, ShoppingCart, Wrench, X, Zap, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

export type HeaderLink = { key: string; label: string; url: string; target: "_self" | "_blank"; children: HeaderLink[] };

const external = (link: HeaderLink) => link.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {};
function matches(pathname: string, url: string) {
  const path = url.split("#")[0].split("?")[0];
  if (!path.startsWith("/")) return false;
  return path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
const isActive = (pathname: string, link: HeaderLink): boolean => matches(pathname, link.url) || link.children.some((child) => isActive(pathname, child));

// Biểu tượng cho mục con của menu: chọn theo đường dẫn (slug ổn định, không đổi khi sửa nhãn). Mục không khớp thì không có biểu tượng;
// bảng chỉ hiện ô biểu tượng khi có ít nhất một mục khớp (menu Hỗ trợ, Tin tức… giữ dạng chữ).
const dropdownIcons: { keys: string[]; icon: LucideIcon }[] = [
  { keys: ["ban-hang"], icon: ShoppingCart },
  { keys: ["tram-sac"], icon: Zap },
  { keys: ["hoa-don", "chu-ky-so"], icon: ReceiptText },
  { keys: ["chuyen-doi-so", "tu-van"], icon: Compass },
  { keys: ["phat-trien-phan-mem", "theo-yeu-cau"], icon: CodeXml },
  { keys: ["ha-tang", "wifi", "camera"], icon: Network },
  { keys: ["data-center", "trung-tam-du-lieu"], icon: Server },
  { keys: ["kiem-soat", "cham-cong"], icon: ShieldCheck },
  { keys: ["tin-tuc"], icon: Newspaper },
  { keys: ["huong-dan"], icon: BookOpen },
  { keys: ["cai-dat"], icon: Wrench },
  { keys: ["ho-tro-tu-xa"], icon: MonitorSmartphone },
  { keys: ["gioi-thieu"], icon: Building2 },
  { keys: ["lien-he"], icon: Phone },
];
const iconFor = (url: string): LucideIcon | null => dropdownIcons.find((entry) => entry.keys.some((key) => url.includes(key)))?.icon ?? null;

// Bảng thả xuống: chỉ các mục con (mục cha đã là liên kết trên menu ngang, bấm vào là sang trang tổng hợp), nối về
// mục cha bằng vạch dạng cây; nhiều mục (>4) chia 2 cột; mục có biểu tượng thì hiện ô biểu tượng.
function DropdownPanel({ link, pathname }: { link: HeaderLink; pathname: string }) {
  const withIcons = link.children.some((child) => iconFor(child.url));
  const wide = link.children.length > 4;
  return <div className={wide ? "site-nav__dropdown site-nav__dropdown--wide" : "site-nav__dropdown"}>
    <ul className="site-nav__dropdown-list site-nav__dropdown-list--tree">{link.children.map((child) => {
      const Icon = withIcons ? (iconFor(child.url) ?? Package) : null;
      return <li key={child.key}><Link aria-current={matches(pathname, child.url) ? "page" : undefined} className="site-nav__dropdown-link" href={child.url} {...external(child)}>
        {Icon ? <span aria-hidden="true" className="site-nav__dropdown-icon"><Icon size={20} strokeWidth={1.75} /></span> : null}
        <span>{child.label}</span>
      </Link></li>;
    })}</ul>
  </div>;
}

// Đầu trang: dính trên cùng, có bóng khi cuộn. Máy tính: menu ngang, mục có con mở bảng thả xuống
// (nhiều mục thì chia 2 cột). Điện thoại: nút ☰ mở bảng menu toàn chiều ngang, mục có con gập/mở.
export function SiteHeaderBar({ actions, brand, links, logo }: { actions: HeaderLink[]; brand: string; links: HeaderLink[]; logo: { url: string; alt: string } | null }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  // Menu điện thoại gắn với đường dẫn lúc mở: chuyển trang là tự đóng.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const mobileOpen = openOn === pathname;
  const [expanded, setExpanded] = useState<string | null>(null);

  // Thanh trượt dưới mục menu: nằm dưới mục của trang đang xem, trượt sang mục đang rê chuột/focus, rời menu thì quay về.
  // Lần hiện đầu tiên (đang ẩn) đặt thẳng vào chỗ, không trượt từ mép trái.
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number; visible: boolean; instant: boolean }>({ left: 0, width: 0, visible: false, instant: true });
  const activeIndex = links.findIndex((link) => isActive(pathname, link));
  const moveBar = useCallback((index: number) => {
    const nav = navRef.current;
    const link = index >= 0 ? nav?.querySelectorAll<HTMLElement>(".site-nav__list > li > .site-nav__link")[index] : undefined;
    if (!nav || !link) { setBar((current) => ({ ...current, visible: false, instant: true })); return; }
    const navBox = nav.getBoundingClientRect(), box = link.getBoundingClientRect(), style = getComputedStyle(link);
    const padLeft = parseFloat(style.paddingLeft), padRight = parseFloat(style.paddingRight);
    setBar((current) => ({ left: box.left - navBox.left + padLeft, width: box.width - padLeft - padRight, visible: true, instant: !current.visible }));
  }, []);
  useEffect(() => {
    const reset = () => moveBar(activeIndex);
    reset();
    // Font web tải xong làm đổi bề rộng chữ: đo lại.
    void document.fonts?.ready.then(reset);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, [activeIndex, moveBar]);
  const leaveNav = (event: FocusEvent<HTMLUListElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) moveBar(activeIndex); };

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
        {logo ? <Image alt={logo.alt} className="h-[2.375rem] w-auto" height={80} priority src={logo.url} width={200} /> : <><span aria-hidden="true" className="brand__mark">i</span>{brand}</>}
      </Link>

      <nav aria-label="Điều hướng chính" className="site-nav" ref={navRef}>
        <ul className="site-nav__list" onBlur={leaveNav} onMouseLeave={() => moveBar(activeIndex)}>{links.map((link, index) => {
          const active = isActive(pathname, link);
          const hover = { onFocus: () => moveBar(index), onMouseEnter: () => moveBar(index) };
          if (!link.children.length) return <li className="site-nav__item" key={link.key} {...hover}><Link aria-current={matches(pathname, link.url) ? "page" : undefined} className={active ? "site-nav__link site-nav__link--active" : "site-nav__link"} href={link.url} {...external(link)}>{link.label}</Link></li>;
          return <li className="site-nav__item site-nav__item--branch" key={link.key} {...hover}>
            <Link aria-haspopup="true" className={active ? "site-nav__link site-nav__link--active" : "site-nav__link"} href={link.url} {...external(link)}>{link.label}<ChevronDown aria-hidden="true" className="site-nav__caret" size={16} /></Link>
            <DropdownPanel link={link} pathname={pathname} />
          </li>;
        })}</ul>
        <span aria-hidden="true" className="site-nav__bar" data-instant={bar.instant} data-visible={bar.visible} style={{ width: bar.width, transform: `translateX(${bar.left}px)` }} />
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
            <div className="site-mobile-menu__row">
              <Link aria-current={matches(pathname, link.url) ? "page" : undefined} className={isActive(pathname, link) ? "site-mobile-menu__link site-mobile-menu__link--active" : "site-mobile-menu__link"} href={link.url} {...external(link)}>{link.label}</Link>
              <button aria-controls={`site-mobile-sub-${link.key}`} aria-expanded={expanded === link.key} aria-label={`${expanded === link.key ? "Đóng" : "Mở"} mục con của ${link.label}`} className="site-mobile-menu__toggle" onClick={() => setExpanded((current) => current === link.key ? null : link.key)} type="button"><ChevronDown aria-hidden="true" className={expanded === link.key ? "rotate-180 transition" : "transition"} size={18} /></button>
            </div>
            {expanded === link.key ? <ul className="site-mobile-menu__children" id={`site-mobile-sub-${link.key}`}>{link.children.map((child) => <li key={child.key}><Link aria-current={matches(pathname, child.url) ? "page" : undefined} className="site-mobile-menu__child" href={child.url} {...external(child)}>{child.label}</Link></li>)}</ul> : null}
          </> : <Link className={isActive(pathname, link) ? "site-mobile-menu__link site-mobile-menu__link--active" : "site-mobile-menu__link"} href={link.url} {...external(link)}>{link.label}</Link>}
        </li>)}</ul>
        {actions.length ? <div className="site-mobile-menu__actions">{actions.map((action, index) => <Link className={`button ${index === actions.length - 1 ? "button--primary" : "button--secondary"}`} href={action.url} key={action.key} {...external(action)}>{action.label}</Link>)}</div> : null}
      </nav>
    </div>
  </>;
}
