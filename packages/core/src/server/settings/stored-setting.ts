import type { z } from "zod";
import { logger } from "../shared/logger";

// Giá trị site_settings được ghi qua Zod, nhưng dữ liệu cũ/nhập tay có thể lệch schema.
// Khi đọc, một khóa hỏng không được làm sập toàn bộ website: ghi log và dùng giá trị dự phòng.
export function parseStoredSetting<Schema extends z.ZodType>(schema: Schema, value: unknown, key: string, fallback: z.output<Schema> | null = null): z.output<Schema> | null {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  logger.error("Cấu hình trong site_settings không hợp lệ; đang dùng giá trị mặc định. Hãy lưu lại cấu hình này trong CMS.", { key, issues: parsed.error.issues.slice(0, 5).map(issue => ({ path: issue.path.join("."), code: issue.code })) });
  return fallback;
}
