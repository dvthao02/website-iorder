import type { CSSProperties } from "react";

// Chuông vàng thắt nơ đỏ để treo lủng lẳng ở các cảnh Giáng sinh (thanh trên CMS theme "Giáng sinh" và đỉnh trang đăng nhập).
// SVG thuần, không id/gradient (nên ẩn bớt vài chiếc bằng display:none cũng không làm hỏng chiếc còn lại), không state, aria-hidden.
// Đung đưa ở CSS (class .xmas-bell trong christmas-login.css): xoay quanh điểm treo (đỉnh dây) như con lắc.
export function ChristmasBell({ className, style }: { className?: string; style?: CSSProperties }) {
  return <svg aria-hidden="true" className={className} focusable="false" style={style} viewBox="0 0 24 36">
    <path d="M12 0 V7" fill="none" stroke="#b8891e" strokeLinecap="round" strokeWidth="1.2" />
    <path d="M11.2 8.4 L9.4 13 L11.6 11.6 Z" fill="#a51d28" />
    <path d="M12.8 8.4 L14.6 13 L12.4 11.6 Z" fill="#a51d28" />
    <path d="M12 8 C9 4.4 4.8 5.6 5.4 8.8 C6 11.2 10 10.2 12 8 Z" fill="#d7263d" />
    <path d="M12 8 C15 4.4 19.2 5.6 18.6 8.8 C18 11.2 14 10.2 12 8 Z" fill="#d7263d" />
    <ellipse cx="12" cy="8.2" fill="#e63946" rx="1.7" ry="1.5" />
    <path d="M12 14 C8.2 14.4 6.4 18.5 6.2 23.2 C6 26.8 5 28.8 3.4 31 H20.6 C19 28.8 18 26.8 17.8 23.2 C17.6 18.5 15.8 14.4 12 14 Z" fill="#e9b73a" />
    <path d="M12 14 C15.8 14.4 17.6 18.5 17.8 23.2 C18 26.8 19 28.8 20.6 31 H14 C15 27.4 14.7 19 12 14 Z" fill="#b8801a" opacity="0.5" />
    <path d="M8.8 17.8 C8.1 20 7.9 22.6 8.1 25.4" fill="none" stroke="#fff4c2" strokeLinecap="round" strokeWidth="1.3" />
    <path d="M3.4 31 H20.6 L19.8 32.8 H4.2 Z" fill="#d9a22a" />
    <circle cx="12" cy="34.2" fill="#c9921b" r="2" />
    <circle cx="11.4" cy="33.6" fill="#f3d27a" r="0.6" />
  </svg>;
}
