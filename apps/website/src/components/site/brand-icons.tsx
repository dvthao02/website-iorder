// Logo mạng xã hội đúng màu thương hiệu, vẽ bằng SVG nội tuyến (không thêm thư viện, không tải ảnh ngoài).
// Dùng cho nút liên hệ nổi và chân trang; nhãn đọc màn hình đặt ở thẻ <a> bao ngoài nên icon ẩn với trình đọc.

import { useId } from "react";

type IconProps = { size?: number; className?: string };

// Logo Zalo chính thức: nền xanh bo góc, bong bóng thoại trắng có đuôi ở góc dưới trái, bóng xanh đậm phía dưới, chữ "Zalo" xanh.
// Vẽ trong hệ tọa độ 800×800 và cắt theo khung bo góc để bong bóng ăn sát mép trên/phải như bản gốc.
export function ZaloIcon({ size = 24, className }: IconProps) {
  const clipId = useId();
  return <svg aria-hidden="true" className={className} height={size} viewBox="0 0 800 800" width={size} xmlns="http://www.w3.org/2000/svg">
    <defs><clipPath id={clipId}><rect height="800" rx="190" width="800" /></clipPath></defs>
    <g clipPath={`url(#${clipId})`}>
      <rect fill="#0068FF" height="800" width="800" />
      <path d="M125 655 265 800H800V592C650 735 400 745 232 640 205 652 160 660 125 655Z" fill="#005AE0" />
      <path d="M232 0C150 50 85 170 85 330c0 110 30 180 65 225 12 17 10 25 8 41-3 24-16 44-33 59 35 5 80-3 107-15 168 105 418 95 568-48V0Z" fill="#fff" />
      <g fill="#0068FF">
        <path d="M190 262H345V300L232 425H345V458H185V420L300 298H190Z" stroke="#0068FF" strokeLinejoin="round" strokeWidth="6" />
        <rect height="196" rx="4" width="32" x="530" y="262" />
        <rect height="146" rx="4" width="30" x="470" y="312" />
      </g>
      <g fill="none" stroke="#0068FF" strokeWidth="32">
        <circle cx="428" cy="392" r="48" />
        <circle cx="661" cy="385" r="57" />
      </g>
    </g>
  </svg>;
}

// Logo Facebook 2023 (Wikimedia Commons, "2023 Facebook icon.svg"): vòng tròn xanh #0866FF, chữ "f" trắng khoét ở dưới.
export function FacebookIcon({ size = 24, className }: IconProps) {
  return <svg aria-hidden="true" className={className} height={size} viewBox="0 0 666.66668 666.66717" width={size} xmlns="http://www.w3.org/2000/svg">
    <g transform="matrix(1.3333333 0 0 -1.3333333 -133.33333 799.99999)">
      <path d="m 0,0 c 0,138.071 -111.929,250 -250,250 -138.071,0 -250,-111.929 -250,-250 0,-117.245 80.715,-215.622 189.606,-242.638 v 166.242 h -51.552 V 0 h 51.552 v 32.919 c 0,85.092 38.508,124.532 122.048,124.532 15.838,0 43.167,-3.105 54.347,-6.211 V 81.986 c -5.901,0.621 -16.149,0.932 -28.882,0.932 -40.993,0 -56.832,-15.528 -56.832,-55.9 V 0 h 81.659 l -14.028,-76.396 h -67.631 V -248.169 C -95.927,-233.218 0,-127.818 0,0" fill="#0866FF" transform="translate(600 350)" />
      <path d="M 0,0 14.029,76.396 H -67.63 v 27.019 c 0,40.372 15.838,55.899 56.831,55.899 12.733,0 22.981,-0.31 28.882,-0.931 v 69.253 c -11.18,3.106 -38.509,6.212 -54.347,6.212 -83.539,0 -122.048,-39.441 -122.048,-124.533 V 76.396 h -51.552 V 0 h 51.552 v -166.242 c 19.343,-4.798 39.568,-7.362 60.394,-7.362 10.254,0 20.358,0.632 30.288,1.831 L -67.63,0 Z" fill="#fff" transform="translate(447.9175 273.6036)" />
    </g>
  </svg>;
}

export function YouTubeIcon({ size = 24, className }: IconProps) {
  return <svg aria-hidden="true" className={className} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <rect fill="#FF0000" height="15" rx="4.2" width="23" x=".5" y="4.5" />
    <path d="M9.75 8.6v6.8L15.6 12z" fill="#fff" />
  </svg>;
}

// Biểu tượng kho ứng dụng cho nút tải ứng dụng ở chân trang (nút nền đen, chữ trắng).
export function AppleIcon({ size = 24, className }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="currentColor" height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M16.37 12.62c-.02-2.27 1.86-3.36 1.94-3.41-1.06-1.55-2.71-1.76-3.29-1.78-1.4-.14-2.73.82-3.44.82-.71 0-1.8-.8-2.96-.78-1.52.02-2.93.89-3.71 2.25-1.58 2.75-.4 6.82 1.14 9.05.75 1.09 1.65 2.32 2.82 2.27 1.13-.04 1.56-.73 2.93-.73 1.36 0 1.75.73 2.95.71 1.22-.02 1.99-1.11 2.74-2.21.86-1.27 1.22-2.5 1.24-2.56-.03-.01-2.37-.91-2.4-3.6zM14.12 5.95c.62-.76 1.05-1.81.93-2.86-.9.04-1.99.6-2.64 1.36-.58.67-1.09 1.75-.95 2.78 1 .08 2.03-.51 2.66-1.28z" />
  </svg>;
}

export function GooglePlayIcon({ size = 24, className }: IconProps) {
  return <svg aria-hidden="true" className={className} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <path d="M3.6 2.2 13.5 12l-9.9 9.8c-.3-.2-.5-.6-.5-1V3.2c0-.4.2-.8.5-1z" fill="#00D7FE" />
    <path d="m16.8 8.7-3.3 3.3L3.6 2.2c.3-.2.8-.2 1.2 0z" fill="#32BB71" />
    <path d="m16.8 15.3-12 6.5c-.4.2-.9.2-1.2 0l9.9-9.8z" fill="#F6B60B" />
    <path d="m20.4 10.7-3.6-2-3.3 3.3 3.3 3.3 3.6-2c1-.6 1-2 0-2.6z" fill="#F23A47" />
  </svg>;
}
