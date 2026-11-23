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

// ===== Nhà thờ Đức Bà Sài Gòn lên đèn Giáng sinh =====
// Hai tháp chuông giống hệt nhau (hệ tọa độ 110 x 600) đứng đối xứng hai bên thẻ đăng nhập, như hai tháp đứng hai bên gian giữa của nhà thờ; thẻ là phần
// gian giữa được thắp sáng (ánh đèn loang ra phía sau thẻ, xem .xmas__cathedral-glow). Gạch đỏ chiếu đèn vàng từ dưới lên nên ấm dần về chân tháp.
// Hình khối là SVG tĩnh (vẽ một lần); các bóng đèn là phần tử HTML đặt chồng lên theo % của khung (như đèn trên cây thông) để chỉ đổi độ mờ,
// không phải vẽ lại cả tòa tháp ở mỗi khung hình. Vị trí và kích thước theo thẻ nằm ở christmas-cathedral.css.

const lampColors = ["#ffd98a", "#fff3cf", "#ff6b6b", "#ffd98a", "#7be0a6"] as const;

// Đèn viền một tháp: hai mép chóp, hai hàng dưới gờ đá, bốn cặp đèn dọc hai góc thân và vòm cửa.
const towerLamps: Array<[number, number]> = (() => {
  const points: Array<[number, number]> = [[55, 38]];
  for (let step = 1; step <= 5; step += 1) {
    const t = step / 7;
    points.push([55 - 24 * (1 - t), 162 - 130 * t], [55 + 24 * (1 - t), 162 - 130 * t]);
  }
  for (const y of [201, 306]) {
    for (const x of [18, 36.5, 55, 73.5, 92]) points.push([x, y]);
  }
  for (const y of [340, 400, 460, 520]) points.push([12, y], [98, y]);
  for (let step = 0; step <= 4; step += 1) {
    const angle = (Math.PI / 4) * step;
    points.push([55 + 17 * Math.cos(angle), 548 - 17 * Math.sin(angle)]);
  }
  return points;
})();

// Bật đèn từ chân tháp lên đỉnh chóp: bóng thấp nhất có --k nhỏ nhất (xem xmas-bulb-on ở christmas-login.css).
const towerLampOrder = [...towerLamps].sort((a, b) => b[1] - a[1]);

// Tuyết đọng trên gờ đá: dải trắng gợn sóng phủ mép trên gờ [x1, x2] ở độ cao y (hai bên nhô ra 2 đơn vị cho giống tuyết rủ).
function snowCap(x1: number, x2: number, y: number) {
  const left = x1 - 2;
  const count = Math.round((x2 + 2 - left) / 11);
  const step = (x2 + 2 - left) / count;
  let path = `M${left} ${y + 3} V${y}`;
  for (let index = 0; index < count; index += 1) path += ` q${step / 2} ${index % 2 === 0 ? -6 : -4.5} ${step} 0`;
  return `${path} V${y + 3} Z`;
}

// Hàng cột băng rủ dưới gờ đá, dài ngắn xen kẽ.
function icicles(x1: number, x2: number, y: number) {
  const lengths = [8, 13, 6, 11];
  let path = "";
  for (let x = x1, index = 0; x + 6 <= x2; x += 9, index += 1) path += `M${x} ${y} L${x + 3} ${y + lengths[index % lengths.length]} L${x + 6} ${y} Z `;
  return path;
}

// Vòng nguyệt quế quanh cửa sổ tròn (tâm 55,360): vòng lá hai lớp, vài quả đỏ và nơ đỏ ở đáy với hai tà rủ xuống.
const wreathBerries = [-150, -110, -70, -30, 20, 160].map((degrees) => [55 + 20 * Math.cos((degrees * Math.PI) / 180), 360 + 20 * Math.sin((degrees * Math.PI) / 180)] as const);

/** Một tháp chuông: chóp sắt có thánh giá, hai ô chuông, cửa sổ tròn và cửa vòm; gạch đỏ chiếu đèn, đèn dây chớp từ chân lên đỉnh. `uid` giữ id gradient không trùng giữa hai tháp. */
function CathedralTower({ className, uid }: { className?: string; uid: string }) {
  return <div aria-hidden="true" className={className}>
    <svg className="xmas__tower-art" focusable="false" viewBox="0 0 110 600">
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${uid}-brick`} x1="0" x2="0" y1="160" y2="580">
          <stop offset="0" stopColor="#5a2033" />
          <stop offset="0.5" stopColor="#9a3b3a" />
          <stop offset="1" stopColor="#e48b50" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${uid}-beam`} x1="0" x2="0" y1="160" y2="580">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0.36" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={`${uid}-spire`} x1="0" x2="0" y1="32" y2="162">
          <stop offset="0" stopColor="#3a3466" />
          <stop offset="1" stopColor="#5a4d86" />
        </linearGradient>
        <radialGradient cx="0.5" cy="0.9" id={`${uid}-door`} r="0.9">
          <stop offset="0" stopColor="#ffe9b0" />
          <stop offset="1" stopColor="#e8893a" />
        </radialGradient>
        <radialGradient id={`${uid}-ground`}>
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.62" />
          <stop offset="1" stopColor="#ffb454" stopOpacity="0" />
        </radialGradient>
        <pattern height="7" id={`${uid}-bricks`} patternUnits="userSpaceOnUse" width="14">
          <path d="M0 0.4H14M0 3.9H14M3.5 0.4V3.9M10.5 3.9V7.4" fill="none" stroke="#2a0a14" strokeOpacity="0.3" strokeWidth="0.6" />
        </pattern>
        <clipPath id={`${uid}-body`}>
          <path d="M8 580 V206 H102 V580 Z M22 206 V162 H88 V206 Z" />
        </clipPath>
      </defs>
      <ellipse cx="55" cy="584" fill={`url(#${uid}-ground)`} rx="62" ry="11" />
      <g clipPath={`url(#${uid}-body)`}>
        <rect fill={`url(#${uid}-brick)`} height="430" width="110" y="160" />
        <rect fill={`url(#${uid}-bricks)`} height="430" width="110" y="160" />
        <path d="M8 580 L38 170 H72 L102 580 Z" fill={`url(#${uid}-beam)`} />
      </g>
      <polygon fill={`url(#${uid}-spire)`} points="31,162 79,162 55,32" stroke="#ffd98a" strokeLinejoin="round" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M55 40 V162 M47 120 H63 M42 140 H68" fill="none" stroke="#ffd98a" strokeOpacity="0.3" strokeWidth="1" />
      <path d="M55 3 V34 M46 14 H64" fill="none" stroke="#ffd98a" strokeLinecap="round" strokeWidth="3" />
      <path d="M49 192 V178 a6 6 0 0 1 12 0 V192 Z" fill="#ffe29a" />
      <rect fill="#f0d7a0" height="10" opacity="0.9" width="78" x="16" y="196" />
      {[37, 73].map((x) => <g key={x}>
        <path d={`M${x - 8} 296 V240 a8 8 0 0 1 16 0 V296 Z`} fill="#ffe29a" />
        <path d={`M${x - 8} 250 H${x + 8} M${x - 8} 260 H${x + 8} M${x - 8} 270 H${x + 8} M${x - 8} 280 H${x + 8} M${x - 8} 290 H${x + 8}`} fill="none" stroke="#8a4a2e" strokeWidth="1" />
        <path d={`M${x - 8} 296 V240 a8 8 0 0 1 16 0 V296`} fill="none" stroke="#f0d7a0" strokeWidth="2" />
      </g>)}
      <rect fill="#f0d7a0" height="12" opacity="0.9" width="102" x="4" y="300" />
      <circle cx="55" cy="360" fill="#ffe29a" r="14" stroke="#f0d7a0" strokeWidth="2.6" />
      <path d="M41 360 H69 M55 346 V374 M45 350 L65 370 M65 350 L45 370" fill="none" stroke="#9a4a2e" strokeWidth="1.3" />
      <circle cx="55" cy="360" fill="#9a4a2e" r="3.2" />
      {[37, 73].map((x) => <path d={`M${x - 5} 470 V410 a5 5 0 0 1 10 0 V470 Z`} fill="#ffe29a" key={x} stroke="#f0d7a0" strokeWidth="1.6" />)}
      <path d="M43 580 V548 a12 12 0 0 1 24 0 V580 Z" fill={`url(#${uid}-door)`} stroke="#f0d7a0" strokeWidth="2.4" />
      <path d="M55 536 V580" fill="none" stroke="#a8561f" strokeOpacity="0.55" strokeWidth="1.2" />
      <rect fill="#f0d7a0" height="8" opacity="0.85" width="102" x="4" y="572" />
      {/* Chi tiết Giáng sinh: tuyết đọng và cột băng trên hai gờ đá, vòng nguyệt quế thắt nơ đỏ quanh cửa sổ tròn. */}
      <path d={snowCap(16, 94, 196)} fill="#f4f9ff" />
      <path d={snowCap(4, 106, 300)} fill="#f4f9ff" />
      <path d={icicles(18, 90, 206)} fill="#e0f0ff" fillOpacity="0.9" />
      <path d={icicles(8, 100, 312)} fill="#e0f0ff" fillOpacity="0.9" />
      <circle cx="55" cy="360" fill="none" r="20" stroke="#1c6b43" strokeWidth="7" />
      <circle cx="55" cy="360" fill="none" r="20" stroke="#3dbb7c" strokeDasharray="4 3" strokeLinecap="round" strokeWidth="3" />
      {wreathBerries.map(([x, y]) => <circle cx={x.toFixed(1)} cy={y.toFixed(1)} fill="#e0344a" key={`${x}-${y}`} r="1.9" />)}
      <path d="M55 380 C46 371 39 380 46 387 C50 390 55 385 55 380 Z M55 380 C64 371 71 380 64 387 C60 390 55 385 55 380 Z" fill="#d7263d" stroke="#a51e30" strokeWidth="0.8" />
      <path d="M53.5 383 L48 397 L52 395 L54.5 398 Z M56.5 383 L62 397 L58 395 L55.5 398 Z" fill="#d7263d" stroke="#a51e30" strokeWidth="0.6" />
      <circle cx="55" cy="381" fill="#b81e32" r="2.6" />
    </svg>
    {towerLampOrder.map(([x, y], index) => <i className="xmas-bulb xmas-bulb--dot xmas-lamp" key={`${x.toFixed(1)}-${y.toFixed(1)}`} style={{ left: `${((x / 110) * 100).toFixed(2)}%`, top: `${((y / 600) * 100).toFixed(2)}%`, "--k": index, "--bulb": lampColors[index % lampColors.length] } as CSSProperties} />)}
  </div>;
}

// Gian giữa (mặt tiền) nằm giữa hai tháp, hệ tọa độ 452 x 410: rộng bằng thẻ đăng nhập cộng 12px mỗi bên chui dưới chân tháp. Thẻ trong suốt nên mặt tiền
// hiện ra sau lớp kính mờ nên không gắn đèn nhấp nháy (đèn sau kính nhòe thành đốm sáng làm rối nội dung thẻ) và các ô sáng được làm dịu màu. Kích thước cố định theo px (thẻ luôn rộng 428px), chỉ có chiều cao tháp đổi theo màn hình.

/** Mặt tiền nhà thờ giữa hai tháp: đầu hồi, hoa hồng, hàng cửa sổ vòm, ba cửa vòm sáng đèn và tượng Đức Mẹ trước cửa chính. */
function CathedralNave({ className }: { className?: string }) {
  return <div aria-hidden="true" className={className}>
    <svg className="xmas__nave-art" focusable="false" viewBox="0 0 452 410">
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="nave-brick" x1="0" x2="0" y1="56" y2="410">
          <stop offset="0" stopColor="#5a2033" />
          <stop offset="0.5" stopColor="#9a3b3a" />
          <stop offset="1" stopColor="#e48b50" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="nave-beam" x1="0" x2="0" y1="56" y2="410">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient cx="0.5" cy="0.9" id="nave-door" r="0.9">
          <stop offset="0" stopColor="#ffe9b0" />
          <stop offset="1" stopColor="#e8893a" />
        </radialGradient>
        <radialGradient id="nave-ground">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb454" stopOpacity="0" />
        </radialGradient>
        <pattern height="7" id="nave-bricks" patternUnits="userSpaceOnUse" width="14">
          <path d="M0 0.4H14M0 3.9H14M3.5 0.4V3.9M10.5 3.9V7.4" fill="none" stroke="#2a0a14" strokeOpacity="0.3" strokeWidth="0.6" />
        </pattern>
        <clipPath id="nave-body">
          <path d="M0 118 L226 56 L452 118 V410 H0 Z" />
        </clipPath>
      </defs>
      <ellipse cx="226" cy="414" fill="url(#nave-ground)" rx="250" ry="14" />
      <g clipPath="url(#nave-body)">
        <rect fill="url(#nave-brick)" height="360" width="452" y="56" />
        <rect fill="url(#nave-bricks)" height="360" width="452" y="56" />
        <rect fill="url(#nave-beam)" height="360" width="452" y="56" />
      </g>
      <path d="M0 118 L226 56 L452 118" fill="none" stroke="#f0d7a0" strokeLinejoin="round" strokeWidth="4" />
      <rect fill="#f0d7a0" height="8" opacity="0.85" width="452" y="118" />
      <circle cx="226" cy="168" fill="#3a1a2a" r="36" stroke="#f0d7a0" strokeWidth="4" />
      <circle cx="226" cy="168" fill="#d9a05a" r="29" />
      <path d="M226 139 V197 M197 168 H255 M205.5 147.5 L246.5 188.5 M246.5 147.5 L205.5 188.5" fill="none" stroke="#9a4a2e" strokeWidth="2" />
      <circle cx="226" cy="168" fill="#9a4a2e" r="6" />
      {[88, 130, 172, 280, 322, 364].map((x) => <path d={`M${x - 7} 266 V221 a7 7 0 0 1 14 0 V266 Z`} fill="#d9a05a" key={x} stroke="#f0d7a0" strokeWidth="1.6" />)}
      <path d="M213 270 V232 a13 13 0 0 1 26 0 V270 Z" fill="#d9a05a" stroke="#f0d7a0" strokeWidth="2" />
      <circle cx="226" cy="241" fill="#fff7e0" r="3.6" />
      <path d="M226 245 L219 266 H233 Z" fill="#fff7e0" />
      <path d="M98 410 V372 a20 20 0 0 1 40 0 V410 Z M314 410 V372 a20 20 0 0 1 40 0 V410 Z" fill="url(#nave-door)" stroke="#f0d7a0" strokeWidth="2.6" />
      <path d="M182 410 V350 a44 44 0 0 1 88 0 V410 Z" fill="url(#nave-door)" stroke="#f0d7a0" strokeWidth="4" />
      <path d="M226 306 V410 M204 346 V410 M248 346 V410" fill="none" stroke="#a8561f" strokeOpacity="0.55" strokeWidth="1.4" />
      <rect fill="#f0d7a0" height="8" opacity="0.8" rx="2" width="132" x="160" y="402" />
      {/* Tượng Đức Mẹ trước cửa chính: áo choàng trắng ngà, quầng sáng quanh đầu. */}
      <rect fill="#f0d7a0" height="28" rx="2" width="18" x="217" y="382" />
      <path d="M226 346 Q215 358 213 382 H239 Q237 358 226 346 Z" fill="#fbf2dc" />
      <circle cx="226" cy="341" fill="#fbf2dc" r="4.6" />
      <circle cx="226" cy="341" fill="none" r="9" stroke="#ffe29a" strokeOpacity="0.9" strokeWidth="1.2" />
    </svg>
  </div>;
}

// 17 bóng trên dây võng nối hai chóp tháp: u là vị trí dọc dây, s = 2·√(u(1−u)) là độ võng theo đường nửa elip của .xmas__swag-wire.
const swagLamps = Array.from({ length: 17 }, (_, index) => {
  const u = index / 16;
  return { s: 2 * Math.sqrt(u * (1 - u)), u };
});

/** Nhà thờ Đức Bà lên đèn: hai tháp chuông hai bên thẻ đăng nhập, mặt tiền giữa hai tháp (hiện qua thẻ trong suốt) và vầng sáng vàng ấm phía sau. */
export function Cathedral({ className }: { className?: string }) {
  return <div aria-hidden="true" className={className}>
    <i className="xmas__cathedral-glow" />
    <CathedralNave className="xmas__nave" />
    <CathedralTower className="xmas__tower xmas__tower--l" uid="tower-l" />
    <CathedralTower className="xmas__tower xmas__tower--r" uid="tower-r" />
    {/* Dây đèn võng nối hai chóp tháp phía trên thẻ ("bầu trời sao nhân tạo"): dây là nửa elip, mỗi bóng có --u (0..1 dọc dây) và --s (độ võng 0..1); vị trí tính trong CSS theo cỡ tháp. */}
    <i className="xmas__swag-wire" />
    {swagLamps.map(({ s, u }, index) => <i className="xmas-bulb xmas-bulb--dot xmas__swag-lamp" key={index} style={{ "--u": u.toFixed(4), "--s": s.toFixed(4), "--k": index, "--bulb": lampColors[index % lampColors.length] } as CSSProperties} />)}
  </div>;
}
