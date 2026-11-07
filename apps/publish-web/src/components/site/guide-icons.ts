import { BookOpen, ChartColumn, CreditCard, LayoutGrid, Package, Printer, ReceiptText, ShoppingCart, UserCog, Users, Utensils, Wallet, type LucideIcon } from "lucide-react";

import { fold } from "@/lib/fold";

// Biểu tượng của bài hướng dẫn theo chức năng nhắc trong tên bài (so khớp không dấu); không khớp thì dùng quyển sách.
const iconRules: [RegExp, LucideIcon][] = [
  [/ban hang|thu ngan|pos\b/, ShoppingCart], [/bao cao|thong ke|doanh thu/, ChartColumn], [/hoa don|chung tu/, ReceiptText],
  [/ket ca|giao ca|\bquy\b|thu chi/, Wallet], [/\bkho\b|ton kho|nhap hang|hang hoa/, Package], [/khach hang|thanh vien|tich diem/, Users],
  [/may in|may quet|driver|thiet bi|cai dat/, Printer], [/thuc don|mon an|san pham/, Utensils], [/nhan vien|phan quyen|tai khoan/, UserCog],
  [/thanh toan|\bqr\b|quet ma/, CreditCard], [/so do|ban an|quan ly ban|phong|khu vuc/, LayoutGrid],
];
export const iconFor = (title: string) => iconRules.find(([pattern]) => pattern.test(fold(title)))?.[1] ?? BookOpen;
