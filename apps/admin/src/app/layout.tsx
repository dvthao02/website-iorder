import type { Metadata } from "next";
import { DM_Sans, Inter, Manrope, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const inter = Inter({ display: "swap", subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const manrope = Manrope({ display: "swap", subsets: ["latin", "vietnamese"], variable: "--font-manrope" });
const dmSans = DM_Sans({ display: "swap", subsets: ["latin", "latin-ext"], variable: "--font-dm-sans" });
const plusJakartaSans = Plus_Jakarta_Sans({ display: "swap", subsets: ["latin", "vietnamese"], variable: "--font-plus-jakarta-sans" });

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
