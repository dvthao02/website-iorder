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
