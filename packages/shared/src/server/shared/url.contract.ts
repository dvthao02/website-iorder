import { z } from "zod";

const allowedProtocols = new Set(["http:", "https:", "mailto:", "tel:"]);

export const safeLinkSchema = z.string().trim().min(1, "Vui lòng nhập đường dẫn.").max(1000, "Đường dẫn không được vượt quá 1.000 ký tự.").refine((value) => {
  if (/[\\\u0000-\u0020]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    return allowedProtocols.has(new URL(value).protocol);
  } catch {
    return false;
  }
}, "Đường dẫn phải là đường dẫn nội bộ hoặc URL http, https, mailto, tel.");
