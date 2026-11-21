import type { CSSProperties } from "react";

import { ChristmasBell } from "../christmas-bell";

// Hình minh họa cho trang đăng nhập mùa Giáng sinh. Chỉ là SVG thuần, vẽ ở server, không có state.
// Chuyển động nằm ở christmas-login.css (class xmas-*); mọi hình đều aria-hidden vì chỉ để trang trí.

const bulbColors = ["#ff5a67", "#ffd166", "#5eead4", "#7cc4ff"] as const;

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

const treeBulbs: Array<[number, number]> = [
  [63, 46], [78, 54], [70, 70],
  [50, 92], [88, 94], [68, 102], [58, 114], [82, 116],
  [34, 140], [56, 130], [96, 132], [112, 142], [44, 152], [72, 148], [92, 154], [24, 160], [116, 160],
];

/**
 * Cây thông ba tầng phủ tuyết và ngôi sao trên đỉnh. Phần thân là SVG tĩnh (vẽ một lần); đèn chớp và vầng sáng ngôi sao là các
 * phần tử HTML đặt chồng lên (tọa độ theo % của viewBox) chỉ đổi độ mờ, nên GPU ghép lớp mà không phải vẽ lại cả cây ở mỗi khung hình.
 * `uid` giữ id gradient không trùng giữa các cây; `className` đặt trên khung bọc.
 */
export function Tree({ className, uid }: { className?: string; uid: string }) {
  return <div className={className}>
    <svg aria-hidden="true" className="xmas__tree-art" focusable="false" viewBox="0 -14 140 228">
      <defs>
        <linearGradient id={`${uid}-leaf`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#35a86c" />
          <stop offset="1" stopColor="#0e5a39" />
        </linearGradient>
        <linearGradient id={`${uid}-leaf-dark`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#2a9060" />
          <stop offset="1" stopColor="#0b4a30" />
        </linearGradient>
      </defs>
      <ellipse cx="70" cy="205" fill="#050b24" opacity="0.4" rx="48" ry="6" />
      <rect fill="#5a3a1f" height="36" rx="3" width="16" x="62" y="170" />
      <path d="M70 70 L124 170 Q70 182 16 170 Z" fill={`url(#${uid}-leaf-dark)`} />
      <path d="M70 40 L112 126 Q70 136 28 126 Z" fill={`url(#${uid}-leaf)`} />
      <path d="M70 12 L100 82 Q70 90 40 82 Z" fill={`url(#${uid}-leaf-dark)`} />
      <path d="M70 12 L80.5 35.8 Q76 32 73 38 Q70 33 67 38 Q63 32 59.5 35.8 Z" fill="#f3f8ff" />
      <path d="M70 40 L84.7 69.4 Q79 65 75 72 Q70 66 65 72 Q61 65 55.3 69.4 Z" fill="#f3f8ff" />
      <path d="M70 70 L88.9 104.3 Q83 100 78 107 Q70 100 62 107 Q57 100 51.1 104.3 Z" fill="#f3f8ff" />
      <polygon fill="#ffd166" points={starPoints(70, 10, 11, 4.6)} />
    </svg>
    <i aria-hidden="true" className="xmas-tree-glow" />
    {treeBulbs.map(([cx, cy], index) => <i aria-hidden="true" className="xmas-bulb xmas-bulb--dot" key={`${cx}-${cy}`} style={{ left: `${((cx / 140) * 100).toFixed(2)}%`, top: `${(((cy + 14) / 228) * 100).toFixed(2)}%`, "--k": treeBulbs.length - 1 - index, "--bulb": bulbColors[index % bulbColors.length] } as CSSProperties} />)}
  </div>;
}

/** Người tuyết đội mũ, quàng khăn đỏ; tay trái vẫy và đuôi khăn đung đưa. */
export function Snowman({ className, uid }: { className?: string; uid: string }) {
  return <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 110 150">
    <defs>
      <radialGradient cx="0.38" cy="0.32" id={`${uid}-snow`} r="0.8">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#c9dbfb" />
      </radialGradient>
    </defs>
    <ellipse cx="55" cy="142" fill="#050b24" opacity="0.35" rx="34" ry="5" />
    <g className="xmas-snowman__arm xmas-snowman__arm--left">
      <path d="M36 68 L12 54 M18 58 L12 48 M22 60 L14 62" fill="none" stroke="#6b4423" strokeLinecap="round" strokeWidth="3" />
    </g>
    <path d="M74 70 L98 82 M92 79 L98 90 M88 77 L96 74" fill="none" stroke="#6b4423" strokeLinecap="round" strokeWidth="3" />
    <circle cx="55" cy="112" fill={`url(#${uid}-snow)`} r="30" />
    <circle cx="55" cy="72" fill={`url(#${uid}-snow)`} r="22" />
    <circle cx="55" cy="40" fill={`url(#${uid}-snow)`} r="16" />
    <path d="M40 52 Q55 63 70 52 L70 58 Q55 69 40 58 Z" fill="#d7263d" />
    <path className="xmas-snowman__scarf" d="M62 60 L69 82 L60 84 L55 64 Z" fill="#b81e32" />
    <rect fill="#1b1f3a" height="18" rx="2" width="24" x="43" y="8" />
    <rect fill="#d7263d" height="4" width="24" x="43" y="20" />
    <ellipse cx="55" cy="26" fill="#1b1f3a" rx="19" ry="4.5" />
    <circle className="xmas-eye" cx="49" cy="38" fill="#1b1f3a" r="1.9" />
    <circle className="xmas-eye" cx="61" cy="38" fill="#1b1f3a" r="1.9" />
    <polygon fill="#ff9f43" points="55,42 71,45 55,47.5" />
    <g fill="#1b1f3a">
      <circle cx="46.5" cy="47" r="1.1" />
      <circle cx="50.5" cy="49.5" r="1.1" />
      <circle cx="55" cy="50.4" r="1.1" />
      <circle cx="59.5" cy="49.5" r="1.1" />
      <circle cx="63.5" cy="47" r="1.1" />
      <circle cx="55" cy="78" r="2.4" />
      <circle cx="55" cy="90" r="2.4" />
      <circle cx="55" cy="102" r="2.4" />
    </g>
  </svg>;
}

/** Ba hộp quà; hộp nhỏ trên cùng thỉnh thoảng rung như đang gọi người mở. */
export function Gifts({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 120 84">
    <ellipse cx="60" cy="80" fill="#050b24" opacity="0.35" rx="54" ry="4" />
    <g>
      <rect fill="#d7263d" height="38" rx="3" width="46" x="8" y="40" />
      <rect fill="#b81e32" height="12" rx="3" width="54" x="4" y="30" />
      <rect fill="#ffd166" height="48" width="7" x="27.5" y="30" />
      <ellipse cx="25" cy="26" fill="#ffd166" rx="9" ry="5" transform="rotate(-24 25 26)" />
      <ellipse cx="38" cy="26" fill="#ffd166" rx="9" ry="5" transform="rotate(24 38 26)" />
      <circle cx="31" cy="28" fill="#f2b83d" r="3.4" />
    </g>
    <g>
      <rect fill="#1f9d63" height="30" rx="3" width="36" x="62" y="48" />
      <rect fill="#17824f" height="10" rx="3" width="42" x="59" y="40" />
      <rect fill="#ffffff" height="38" width="6" x="77" y="40" />
      <rect fill="#ffffff" height="6" width="36" x="62" y="60" />
    </g>
    <g className="xmas-gift-shake">
      <rect fill="#3b82f6" height="16" rx="2" width="22" x="69" y="24" />
      <rect fill="#2f6fd6" height="6" rx="2" width="26" x="67" y="20" />
      <rect fill="#ffd166" height="22" width="5" x="77.5" y="20" />
      <circle cx="80" cy="17" fill="#ffd166" r="3.2" />
    </g>
  </svg>;
}

/** Mũ ông già Noel đội ở góc thẻ đăng nhập. */
export function SantaHat({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 92 84">
    <path d="M10 58 Q16 10 60 8 Q56 32 82 58 Z" fill="#d7263d" />
    <path d="M10 58 Q16 10 60 8 Q44 26 40 58 Z" fill="#b81e32" opacity="0.55" />
    <rect fill="#ffffff" height="20" rx="10" width="86" x="3" y="52" />
    <circle className="xmas-hat__pom" cx="64" cy="11" fill="#ffffff" r="9" />
  </svg>;
}

// Một con tuần lộc nhìn sang phải, local 0..84 x -20..60. Chân chạy nước kiệu, mũi đỏ phát sáng, gạc nhiều nhánh, yên cương đỏ có chuông vàng.
// Gradient dùng chung id "ss-*" của SantaSleigh (chỉ có một xe trên trang).
function Reindeer({ offset, x, y }: { offset: number; x: number; y: number }) {
  const legStyle = (delay: number): CSSProperties => ({ animationDelay: `${delay + offset}s` });
  return <g transform={`translate(${x} ${y})`}>
    <g strokeLinecap="round" strokeWidth="4.4">
      <path className="xmas-leg" d="M16 34 L12 54" stroke="#7a4b2b" style={legStyle(0)} />
      <path className="xmas-leg" d="M48 33 L56 52" stroke="#7a4b2b" style={legStyle(0)} />
      <path className="xmas-leg" d="M24 35 L24 55" stroke="#9a6540" style={legStyle(-0.25)} />
      <path className="xmas-leg" d="M40 35 L43 55" stroke="#9a6540" style={legStyle(-0.25)} />
    </g>
    <path d="M7 21 Q2 19 4 25 Q6 28 10 26 Z" fill="#fff6e8" />
    <ellipse cx="32" cy="27" fill="url(#ss-deer)" rx="24" ry="11.5" />
    <ellipse cx="33" cy="33" fill="#f0d6b0" opacity="0.85" rx="17" ry="5" />
    <path d="M49 25 Q60 19 63 7" fill="none" stroke="url(#ss-deer)" strokeLinecap="round" strokeWidth="10.5" />
    <path d="M52 26 Q59 31 54 37 Q50 32 52 26 Z" fill="#fff6e8" />
    <path d="M64 -1 Q57 -9 53 -5 Q57 -1 63 1 Z" fill="#8a5732" />
    <path d="M62 -1 Q58 -5 56 -4 Q58 -1 62 0 Z" fill="#e9a79b" />
    <ellipse cx="68" cy="6" fill="#ad7a4f" rx="9" ry="6.2" transform="rotate(-12 68 6)" />
    <ellipse cx="75.5" cy="9.5" fill="#c99a6c" rx="5.6" ry="4" />
    <circle cx="80" cy="9.8" fill="#ff3b3b" opacity="0.28" r="6.6" />
    <circle className="xmas-nose" cx="80" cy="9.8" fill="#ff3b3b" r="3" />
    <circle cx="69.5" cy="4" fill="#1b1f3a" r="1.5" />
    <circle cx="70" cy="3.4" fill="#ffffff" r="0.5" />
    <g fill="none" stroke="#f3e3c3" strokeLinecap="round" strokeWidth="1.9">
      <path d="M66 -1 Q64 -11 59 -17 M64.5 -7 Q59 -9 55 -8 M63 -11 Q66 -16 64 -21 M67.5 -2 Q70 -11 76 -15 M69.5 -8 Q75 -8 78 -12" />
    </g>
    <path d="M44 20 Q53 30 46 38" fill="none" stroke="#d7263d" strokeLinecap="round" strokeWidth="3" />
    <path d="M54 20 Q62 18 64 10" fill="none" stroke="#d7263d" strokeLinecap="round" strokeWidth="3.2" />
    <path d="M62 12 Q69 8 73 11" fill="none" stroke="#e9b83a" strokeLinecap="round" strokeWidth="1.3" />
    <circle cx="58" cy="23" fill="#ffd36a" r="3.6" />
    <circle cx="57" cy="22" fill="#fff4c4" r="1.2" />
    <path d="M20 19 Q36 13 53 20" fill="none" stroke="#e9b83a" strokeWidth="1.6" />
  </g>;
}

/**
 * Xe trượt tuyết của ông già Noel kéo bởi hai tuần lộc, nhìn sang phải. Dịch chuyển do CSS (.xmas__santa).
 * Xe sơn đỏ viền vàng, bao quà và hộp quà phía sau; Noel có râu, mũ bay ngược chiều gió, một tay vẫy (.xmas-santa-arm) và cái ngù mũ đung đưa (.xmas-pom).
 * Chỉ một bản trên trang nên dùng id gradient cố định (ss-*).
 */
export function SantaSleigh({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 410 132">
    <defs>
      <linearGradient id="ss-red" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f2495a" /><stop offset="1" stopColor="#ad1a2c" /></linearGradient>
      <linearGradient id="ss-sack" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#b9774a" /><stop offset="1" stopColor="#6b3e21" /></linearGradient>
      <linearGradient id="ss-fur" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe8f5" /></linearGradient>
      <linearGradient id="ss-skin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ffe5cb" /><stop offset="1" stopColor="#f4bc94" /></linearGradient>
      <linearGradient id="ss-deer" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#c0865a" /><stop offset="1" stopColor="#8a5732" /></linearGradient>
    </defs>
    <g transform="translate(0 12)">
      {/* Bao quà và hộp quà phía sau (vẽ trước thân xe để mép xe che phần dưới) */}
      <ellipse cx="34" cy="41" fill="url(#ss-sack)" rx="23" ry="21" />
      <path d="M19 34 Q25 22 38 22" fill="none" opacity="0.6" stroke="#dba777" strokeLinecap="round" strokeWidth="2.6" />
      <path d="M25 22 Q34 12 43 22 L40.5 27 Q34 21.5 27.5 27 Z" fill="#d7263d" />
      <circle cx="34" cy="21" fill="#f2c14e" r="2.6" />
      <path d="M34 36 L36.2 40.6 L41.2 41 L37.4 44.2 L38.6 49 L34 46.4 L29.4 49 L30.6 44.2 L26.8 41 L31.8 40.6 Z" fill="#ffd166" />
      <rect fill="#1f9d63" height="19" rx="2.5" width="24" x="56" y="40" />
      <rect fill="#ffffff" height="19" width="4.5" x="65.8" y="40" />
      <rect fill="#3b82f6" height="14" rx="2.5" width="17" x="61" y="27" />
      <rect fill="#ffd166" height="14" width="4" x="67.5" y="27" />
      <path d="M69.5 27 Q62 19 65 25 Z M69.5 27 Q77 19 74 25 Z" fill="#ffd166" />

      {/* Ông già Noel (vẽ trước thân xe để mép xe che nửa người dưới) */}
      <ellipse cx="104" cy="48" fill="url(#ss-red)" rx="18" ry="17" />
      <path d="M104 33 V62" stroke="#ffffff" strokeLinecap="round" strokeWidth="4.6" />
      <rect fill="#1b1f3a" height="5.6" rx="1.6" width="36" x="86" y="50" />
      <rect fill="#f2c14e" height="8.6" rx="1.6" width="11" x="98" y="48.6" />
      <rect fill="#1b1f3a" height="3.6" rx="0.8" width="5" x="101" y="51" />
      <path d="M91 46 Q83 55 96 58" fill="none" stroke="#c9243a" strokeLinecap="round" strokeWidth="7" />
      <circle cx="97" cy="58" fill="#ffffff" r="4.2" />
      <g className="xmas-santa-arm">
        <path d="M118 43 Q131 39 134 27" fill="none" stroke="#c9243a" strokeLinecap="round" strokeWidth="7.4" />
        <circle cx="133.6" cy="26.4" fill="url(#ss-fur)" r="4.6" />
        <circle cx="134.6" cy="20.6" fill="#ffffff" r="4.2" />
      </g>
      <circle cx="106" cy="24" fill="url(#ss-skin)" r="11.5" />
      <circle cx="100.2" cy="27.4" fill="#ff8f9f" opacity="0.55" r="2.8" />
      <circle cx="111.8" cy="27.4" fill="#ff8f9f" opacity="0.55" r="2.8" />
      <ellipse cx="102" cy="22.6" fill="#2a1d1d" rx="1.3" ry="1.7" />
      <ellipse cx="110" cy="22.6" fill="#2a1d1d" rx="1.3" ry="1.7" />
      <path d="M99.4 19.4 Q102 17.4 104.6 19.2 M107.4 19.2 Q110 17.4 112.6 19.4" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="1.7" />
      <path d="M94.6 24 Q93.4 41 106 42 Q118.6 41 117.4 24 Q113.5 31 106 30.6 Q98.5 31 94.6 24 Z" fill="url(#ss-fur)" stroke="#d3deee" strokeWidth="0.6" />
      <path d="M98.6 27 Q102.6 22.6 106 26.6 Q109.4 22.6 113.4 27 Q109.8 31.2 106 28.6 Q102.2 31.2 98.6 27 Z" fill="#ffffff" stroke="#d3deee" strokeWidth="0.5" />
      <circle cx="106" cy="25.2" fill="#f08a8a" r="2.5" />
      <path d="M95.5 17 Q93.5 1 105 -4 Q114 -8 120.5 -2 Q125 3 122.5 17 Z" fill="url(#ss-red)" />
      <path d="M113 -5 Q125 3 122.5 17 H117 Q120.5 5 113 -5 Z" fill="#9b1727" opacity="0.5" />
      <path d="M105 -4 Q94 -14 80 -5 Q75 -2 78 3 Q87 -2 97 1.6 Z" fill="url(#ss-red)" />
      <g className="xmas-pom">
        <circle cx="76.6" cy="2" fill="url(#ss-fur)" r="5.2" />
      </g>
      <rect fill="url(#ss-fur)" height="8.4" rx="4.2" stroke="#d3deee" strokeWidth="0.5" width="32" x="93" y="11" />

      {/* Xe: ván trượt vàng, thân sơn đỏ viền vàng, đuôi và mũi cuộn tròn */}
      <path d="M4 112 Q0 98 16 98 H128 Q154 98 160 70" fill="none" stroke="#f0c04a" strokeLinecap="round" strokeWidth="4.6" />
      <path d="M12 106 H122" fill="none" opacity="0.55" stroke="#fff3c4" strokeLinecap="round" strokeWidth="1.2" />
      <path d="M40 98 V88 M104 98 V88" stroke="#f0c04a" strokeLinecap="round" strokeWidth="3.4" />
      <path d="M8 56 H148 Q152 88 118 92 H38 Q10 92 8 56 Z" fill="url(#ss-red)" />
      <path d="M8 56 H148" stroke="#f6cd62" strokeLinecap="round" strokeWidth="4.4" />
      <path d="M30 76 Q50 66 68 76 T106 76" fill="none" opacity="0.95" stroke="#f6cd62" strokeLinecap="round" strokeWidth="2.2" />
      <circle cx="30" cy="76" fill="#f6cd62" r="2.4" />
      <circle cx="106" cy="76" fill="#f6cd62" r="2.4" />
      <path d="M148 56 Q166 54 164 38 Q163 30 154 31" fill="none" stroke="#d7263d" strokeLinecap="round" strokeWidth="6" />
      <circle cx="154" cy="31" fill="#f6cd62" r="3.6" />
      <path d="M8 56 Q-2 54 1 42 Q3 34 11 37" fill="none" stroke="#d7263d" strokeLinecap="round" strokeWidth="5" />
      <circle cx="11" cy="37" fill="#f6cd62" r="3" />
    </g>
    {/* Dây cương vàng nối tay Noel tới hai con tuần lộc */}
    <path d="M100 70 Q170 92 230 68 M230 66 Q284 54 338 62" fill="none" stroke="#e9b83a" strokeWidth="1.7" />
    <Reindeer offset={0} x={176} y={46} />
    <Reindeer offset={-0.12} x={278} y={40} />
  </svg>;
}

/**
 * Giỏ quà treo dưới dù, thả từ xe trượt của ông già Noel (CSS .xmas__drop làm nó rơi, .xmas__drop svg làm nó đung đưa quanh đỉnh dù).
 * Chỉ dùng màu phẳng, không id/gradient: được dựng nhiều bản trên cùng một trang.
 */
export function GiftBasket({ className }: { className?: string }) {
  return <svg aria-hidden="true" className={className} focusable="false" viewBox="0 0 60 92">
    <path d="M3 30 C3 10 17 2 30 2 C43 2 57 10 57 30 Z" fill="#e53a45" />
    <path d="M30 2 C21 4 14 14 13 30 H30 Z M30 2 C39 4 46 14 47 30 H30 Z" fill="#ffffff" opacity="0.88" />
    <path d="M3 30 Q10 35 17 30 Q23.5 35 30 30 Q36.5 35 43 30 Q50 35 57 30" fill="none" stroke="#b5202c" strokeWidth="1.2" />
    <path d="M5 32 L24 60 M30 33 V60 M55 32 L36 60" fill="none" stroke="#f3e6c4" strokeLinecap="round" strokeWidth="1.2" />
    <rect fill="#d7263d" height="9" rx="1" width="10" x="19" y="55" />
    <path d="M24 55 V64 M19 59.5 H29" stroke="#ffd166" strokeWidth="1.6" />
    <rect fill="#17724a" height="11" rx="1" width="11" x="31" y="53" />
    <path d="M36.5 53 V64 M31 58.5 H42" stroke="#ffd166" strokeWidth="1.6" />
    <path d="M33 53 Q36.5 46 40 53" fill="none" stroke="#ffd166" strokeLinecap="round" strokeWidth="1.6" />
    <path d="M18 62 Q30 50 42 62" fill="none" stroke="#8a5726" strokeLinecap="round" strokeWidth="2" />
    <path d="M14 62 H46 L42 87 Q41.6 89 39.6 89 H20.4 Q18.4 89 18 87 Z" fill="#c98a45" stroke="#8a5726" strokeLinejoin="round" strokeWidth="1.3" />
    <path d="M15.5 69 H44.5 M16.5 75 H43.5 M17.5 81 H42.5 M24 62 L22.5 88 M30 62 V89 M36 62 L37.5 88" fill="none" stroke="#8a5726" strokeWidth="0.9" />
  </svg>;
}

/**
 * Dây kim tuyến xanh phủ sương, thắt nơ đỏ, có 11 bóng đèn vàng ấm mỗi nhịp chớp nhẹ xen kẽ, giăng thành các nhịp võng trên đỉnh trang.
 * Là ảnh SVG lặp ngang (public/brand/xmas-garland*.svg), dùng chung với thanh trên của CMS theme "Giáng sinh" qua lớp .xmas-tinsel (christmas-login.css).
 */
export function Garland() {
  return <>
    <div aria-hidden="true" className="xmas-tinsel xmas__garland" />
    {/* Chuông treo ở đáy (chỗ võng sâu nhất) của từng nhịp dây: vị trí = nửa nhịp + n nhịp, nhịp lấy từ --step của .xmas__bells. */}
    <div aria-hidden="true" className="xmas__bells">
      {Array.from({ length: 8 }, (_, index) => <ChristmasBell className="xmas-bell xmas__bell" key={index} style={{ "--n": index } as CSSProperties} />)}
    </div>
  </>;
}

const mountainPeaks: Array<[number, number]> = [[120, 150], [330, 92], [560, 126], [820, 86], [1060, 132], [1300, 100]];

/** Dãy núi xa có chỏm tuyết. Kéo giãn theo bề ngang (preserveAspectRatio none) nên chỉ vẽ hình khối, không có chi tiết nhỏ. */
export function Mountains({ className }: { className?: string }) {
  const outline = "M0 320 V200 L120 150 L210 206 L330 92 L450 196 L560 126 L690 214 L820 86 L940 204 L1060 132 L1180 212 L1300 100 L1440 188 V320 Z";
  return <svg aria-hidden="true" className={className} focusable="false" preserveAspectRatio="none" viewBox="0 0 1440 320">
    <defs>
      <linearGradient id="xmas-mountain" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#3a4ba8" />
        <stop offset="1" stopColor="#1a2466" />
      </linearGradient>
    </defs>
    <path d={outline} fill="url(#xmas-mountain)" />
    {mountainPeaks.map(([x, y]) => <path d={`M${x} ${y} L${x - 42} ${y + 40} L${x - 20} ${y + 32} L${x} ${y + 50} L${x + 20} ${y + 32} L${x + 42} ${y + 40} Z`} fill="#dbe8ff" key={x} opacity="0.88" />)}
  </svg>;
}

/** Đồi tuyết xa (xanh nhạt) và gần (trắng ánh trăng). */
export function Hills({ className, variant }: { className?: string; variant: "far" | "near" }) {
  const far = variant === "far";
  return <svg aria-hidden="true" className={className} focusable="false" preserveAspectRatio="none" viewBox="0 0 1440 220">
    <defs>
      <linearGradient id={`xmas-hill-${variant}`} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor={far ? "#8fa9e8" : "#f3f7ff"} />
        <stop offset="1" stopColor={far ? "#5d78c6" : "#b9cdf5"} />
      </linearGradient>
    </defs>
    <path d={far ? "M0 110 Q200 30 430 84 T850 76 T1220 60 T1440 96 V220 H0 Z" : "M0 84 Q240 14 520 66 T1010 56 T1440 34 V220 H0 Z"} fill={`url(#xmas-hill-${variant})`} />
  </svg>;
}

/** Nhà gỗ trên đồi: ống khói nhả khói bay lên, hai cửa sổ ấm áp lập lòe như ánh lửa. */
export function Cabin({ className, uid }: { className?: string; uid: string }) {
  return <svg aria-hidden="true" className={className} focusable="false" viewBox="0 -30 130 140">
    <defs>
      <radialGradient id={`${uid}-warm`}>
        <stop offset="0" stopColor="#ffd27a" stopOpacity="0.75" />
        <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="65" cy="103" fill="#050b24" opacity="0.3" rx="60" ry="5" />
    <g fill="#d9e6ff">
      <circle className="xmas-smoke" cx="88" cy="10" r="6" />
      <circle className="xmas-smoke xmas-smoke--2" cx="88" cy="10" r="6" />
      <circle className="xmas-smoke xmas-smoke--3" cx="88" cy="10" r="6" />
    </g>
    <rect fill="#5b3a1f" height="26" width="13" x="80" y="18" />
    <rect fill="#f3f8ff" height="5" rx="2" width="17" x="78" y="14" />
    <rect fill="#8a5a36" height="46" width="84" x="23" y="56" />
    <path d="M23 66 H107 M23 76 H107 M23 86 H107 M23 96 H107" fill="none" stroke="#6f4528" strokeWidth="1.6" />
    <polygon fill="#7a3b2e" points="12,60 65,14 118,60" />
    <path d="M12 60 L65 14 L118 60 Q104 54 92 57 Q78 50 65 57 Q52 50 38 57 Q24 54 12 60 Z" fill="#f3f8ff" />
    <circle className="xmas-window-glow" cx="42" cy="78" fill={`url(#${uid}-warm)`} r="26" />
    <circle className="xmas-window-glow xmas-window-glow--2" cx="88" cy="78" fill={`url(#${uid}-warm)`} r="26" />
    <g className="xmas-window">
      <rect fill="#ffd27a" height="17" rx="2" width="19" x="33" y="70" />
      <path d="M42.5 70 V87 M33 78.5 H52" stroke="#8a5a36" strokeWidth="1.6" />
    </g>
    <g className="xmas-window xmas-window--2">
      <rect fill="#ffd27a" height="17" rx="2" width="19" x="79" y="70" />
      <path d="M88.5 70 V87 M79 78.5 H98" stroke="#8a5a36" strokeWidth="1.6" />
    </g>
    <rect fill="#4a2c17" height="26" rx="2" width="16" x="57" y="76" />
    <circle cx="61" cy="90" fill="#ffd166" r="1.2" />
    <circle cx="65" cy="82" fill="none" r="4.6" stroke="#2f9e63" strokeWidth="2" />
    <circle cx="62" cy="79" fill="#ff5a67" r="1.1" />
    <circle cx="68" cy="85" fill="#ff5a67" r="1.1" />
    <ellipse cx="65" cy="103" fill="#e8f0ff" rx="62" ry="7" />
  </svg>;
}
