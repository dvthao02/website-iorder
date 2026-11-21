import type { Metadata } from "next";
import { DM_Sans, Inter, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import { VietnameseValidation } from "@/components/admin/ui/vietnamese-validation";

import "./globals.css";

// Chỉ Inter (mặc định) được nạp trước. Ba font còn lại (người vận hành tự chọn ở Giao diện CMS) để preload: false: CSS vẫn khai báo @font-face
// nhưng trình duyệt chỉ tải tệp font khi chữ thật sự dùng tới nó, nên mỗi lần mở CMS không phải tải trước ~125 KB font không dùng.
const inter = Inter({ display: "swap", subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const manrope = Manrope({ display: "swap", preload: false, subsets: ["latin", "vietnamese"], variable: "--font-manrope" });
const dmSans = DM_Sans({ display: "swap", preload: false, subsets: ["latin", "latin-ext"], variable: "--font-dm-sans" });
const plusJakartaSans = Plus_Jakarta_Sans({ display: "swap", preload: false, subsets: ["latin", "vietnamese"], variable: "--font-plus-jakarta-sans" });

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "iOrder CMS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={`${inter.variable} ${manrope.variable} ${dmSans.variable} ${plusJakartaSans.variable}`}
      data-scroll-behavior="smooth"
      lang="vi"
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <VietnameseValidation />
        {children}
      </body>
    </html>
  );
}
