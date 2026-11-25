import { Globe } from "lucide-react";
import { useId, type ReactElement } from "react";

/**
 * Cờ nhỏ cho nút chọn ngôn ngữ, vẽ bằng SVG nội tuyến (không tải ảnh, hiện đúng trên Windows vốn không có cờ emoji). Thêm ngôn ngữ mới thì thêm
 * một cờ vào `flags` (hoặc một dải màu vào `stripedFlags`); ngôn ngữ chưa có cờ (Bồ Đào Nha, Khmer, Lào, Hindi, Thổ Nhĩ Kỳ, Mã Lai…) hiện biểu tượng quả địa cầu. Chỉ để trang trí (tên ngôn ngữ luôn có chữ bên cạnh) nên ẩn với trình đọc màn hình.
 */
const vietnamStar = "15.00,4.10 16.48,8.66 21.28,8.66 17.40,11.48 18.88,16.04 15.00,13.22 11.12,16.04 12.60,11.48 8.72,8.66 13.52,8.66";

function VietnamFlag() {
  return <svg aria-hidden="true" className="language-flag" focusable="false" viewBox="0 0 30 20">
    <rect fill="#da251d" height="20" width="30" />
    <polygon fill="#ffff00" points={vietnamStar} />
  </svg>;
}

// Quốc kỳ Anh dạng rút gọn (nền xanh, hai đường chéo, chữ thập), dùng cho tiếng Anh.
function EnglishFlag() {
  const id = useId();
  const frame = `${id}-frame`;
  const diagonal = `${id}-diagonal`;
  return <svg aria-hidden="true" className="language-flag" focusable="false" preserveAspectRatio="none" viewBox="0 0 60 30">
    <clipPath id={frame}><path d="M0,0 v30 h60 v-30 z" /></clipPath>
    <clipPath id={diagonal}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
    <g clipPath={`url(#${frame})`}>
      <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6" />
      <path clipPath={`url(#${diagonal})`} d="M0,0 L60,30 M60,0 L0,30" stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </g>
  </svg>;
}

// Cờ dạng các dải màu (rộng/cao theo tỉ lệ): mỗi phần tử là [màu, độ dày tương đối].
type Band = [color: string, weight: number];

function StripedFlag({ bands, vertical = false }: { bands: Band[]; vertical?: boolean }) {
  const total = bands.reduce((sum, [, weight]) => sum + weight, 0);
  const span = vertical ? 30 : 20;
  return <svg aria-hidden="true" className="language-flag" focusable="false" preserveAspectRatio="none" viewBox="0 0 30 20">
    {bands.map(([color, weight], index) => {
      const start = (bands.slice(0, index).reduce((sum, [, before]) => sum + before, 0) / total) * span;
      const size = (weight / total) * span;
      return vertical ? <rect fill={color} height="20" key={index} width={size} x={start} y="0" /> : <rect fill={color} height={size} key={index} width="30" x="0" y={start} />;
    })}
  </svg>;
}

const stripedFlags: Record<string, { bands: Band[]; vertical?: boolean }> = {
  fr: { bands: [["#0055a4", 1], ["#ffffff", 1], ["#ef4135", 1]], vertical: true },
  it: { bands: [["#009246", 1], ["#ffffff", 1], ["#ce2b37", 1]], vertical: true },
  de: { bands: [["#000000", 1], ["#dd0000", 1], ["#ffce00", 1]] },
  es: { bands: [["#aa151b", 1], ["#f1bf00", 2], ["#aa151b", 1]] },
  ru: { bands: [["#ffffff", 1], ["#0039a6", 1], ["#d52b1e", 1]] },
  nl: { bands: [["#ae1c28", 1], ["#ffffff", 1], ["#21468b", 1]] },
  pl: { bands: [["#ffffff", 1], ["#dc143c", 1]] },
  id: { bands: [["#ce1126", 1], ["#ffffff", 1]] },
  th: { bands: [["#a51931", 1], ["#f4f5f8", 1], ["#2d2a4a", 2], ["#f4f5f8", 1], ["#a51931", 1]] },
};

function JapanFlag() {
  return <svg aria-hidden="true" className="language-flag" focusable="false" viewBox="0 0 30 20">
    <rect fill="#ffffff" height="20" width="30" />
    <circle cx="15" cy="10" fill="#bc002d" r="6" />
  </svg>;
}

// Ngôi sao năm cánh: một cánh hướng theo góc `pointAngle` (radian), cánh trong bằng 0,382 bán kính ngoài.
function starPoints(cx: number, cy: number, radius: number, pointAngle: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = pointAngle + (index * Math.PI) / 5;
    const length = index % 2 === 0 ? radius : radius * 0.382;
    return `${(cx + length * Math.cos(angle)).toFixed(2)},${(cy + length * Math.sin(angle)).toFixed(2)}`;
  }).join(" ");
}

// Cờ Trung Quốc: một sao lớn ở góc trên bên trái và bốn sao nhỏ xếp cung bên phải, mỗi sao nhỏ có một cánh hướng về sao lớn. Phải có đủ năm sao để
// không bị nhầm với cờ Việt Nam (nền đỏ, một sao vàng ở giữa) khi vẽ nhỏ.
const chinaBigStar = { x: 5, y: 5 };
const chinaSmallStars = [[10, 2], [12, 4], [12, 7], [10, 9]] as const;
function ChinaFlag() {
  return <svg aria-hidden="true" className="language-flag" focusable="false" viewBox="0 0 30 20">
    <rect fill="#de2910" height="20" width="30" />
    <polygon fill="#ffde00" points={starPoints(chinaBigStar.x, chinaBigStar.y, 3, -Math.PI / 2)} />
    {chinaSmallStars.map(([x, y]) => <polygon fill="#ffde00" key={`${x}-${y}`} points={starPoints(x, y, 1, Math.atan2(chinaBigStar.y - y, chinaBigStar.x - x))} />)}
  </svg>;
}

// Cờ Hàn Quốc rút gọn (nền trắng, thái cực đỏ xanh, bỏ bốn quẻ) để vẫn rõ ở cỡ nhỏ.
function KoreaFlag() {
  return <svg aria-hidden="true" className="language-flag" focusable="false" viewBox="0 0 30 20">
    <rect fill="#ffffff" height="20" width="30" />
    <path d="M9 10a6 6 0 0 1 12 0z" fill="#cd2e3a" />
    <path d="M9 10a6 6 0 0 0 12 0z" fill="#0047a0" />
  </svg>;
}

const flags: Record<string, () => ReactElement> = {
  vi: VietnamFlag, en: EnglishFlag, ja: JapanFlag, zh: ChinaFlag, ko: KoreaFlag,
  ...Object.fromEntries(Object.entries(stripedFlags).map(([code, flag]) => [code, () => <StripedFlag {...flag} />])),
};

export function LanguageFlag({ code }: { code: string }) {
  const Flag = flags[code];
  return Flag ? <Flag /> : <Globe aria-hidden="true" className="language-flag language-flag--globe" size={18} />;
}
