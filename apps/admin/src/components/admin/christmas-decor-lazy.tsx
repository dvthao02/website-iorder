"use client";

import dynamic from "next/dynamic";

import { useCmsColorTheme } from "./admin-theme-settings";

// Trang trí theme "Giáng sinh" (cây thông, chuông, tuyết rơi, ~200 dòng) chỉ cần khi người vận hành chọn theme đó. Tách thành gói riêng và chỉ
// tải khi theme đang là Giáng sinh, để mọi trang CMS của các theme khác không phải tải và chạy mã này. Theme đọc từ localStorage sau khi
// hydrate (server luôn dựng theme mặc định) nên phần trang trí vốn chưa bao giờ nằm trong HTML dựng sẵn: tải trễ không làm đổi gì.
const BrandDecor = dynamic(() => import("./christmas-shell-decor").then((module) => module.ChristmasBrandDecor), { ssr: false });
const TopbarDecor = dynamic(() => import("./christmas-shell-decor").then((module) => module.ChristmasTopbarDecor), { ssr: false });

export function LazyChristmasBrandDecor() {
  return useCmsColorTheme() === "christmas" ? <BrandDecor /> : null;
}

export function LazyChristmasTopbarDecor() {
  return useCmsColorTheme() === "christmas" ? <TopbarDecor /> : null;
}
