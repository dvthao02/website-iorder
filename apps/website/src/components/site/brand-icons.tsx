// Logo mạng xã hội đúng màu thương hiệu, vẽ bằng SVG nội tuyến (không thêm thư viện, không tải ảnh ngoài).
// Dùng cho nút liên hệ nổi và chân trang; nhãn đọc màn hình đặt ở thẻ <a> bao ngoài nên icon ẩn với trình đọc.

type IconProps = { size?: number; className?: string };

export function ZaloIcon({ size = 24, className }: IconProps) {
  return <svg aria-hidden="true" className={className} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <rect fill="#0068FF" height="24" rx="6" width="24" />
    <ellipse cx="12.2" cy="11" fill="#fff" rx="9.2" ry="7.4" />
    <path d="M5.4 15.4c-.3 1.6-1 2.9-1.9 3.7 1.8.2 3.8-.4 5.2-1.4Z" fill="#fff" />
    <text fill="#0068FF" fontFamily="Arial, Helvetica, sans-serif" fontSize="6.8" fontWeight="800" letterSpacing="-.25" textAnchor="middle" x="12.3" y="13.4">Zalo</text>
  </svg>;
}

export function FacebookIcon({ size = 24, className }: IconProps) {
  return <svg aria-hidden="true" className={className} height={size} viewBox="0 0 24 24" width={size} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" fill="#1877F2" r="12" />
    <path d="M15.12 15.47l.47-3.04h-2.92v-1.97c0-.83.41-1.64 1.72-1.64h1.33V6.23s-1.2-.21-2.36-.21c-2.41 0-3.98 1.46-3.98 4.1v2.31H6.71v3.04h2.67V24h3.29v-8.53z" fill="#fff" />
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
