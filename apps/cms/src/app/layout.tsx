import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "iOrder CMS",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="vi"><body suppressHydrationWarning>{children}</body></html>;
}
