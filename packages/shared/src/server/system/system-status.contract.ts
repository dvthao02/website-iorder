import { z } from "zod";

// Tình trạng hệ thống cho người vận hành (màn CMS "Tình trạng hệ thống", quyền system.view). Chỉ chứa số đo và nhãn trạng thái:
// KHÔNG bao giờ có giá trị biến môi trường, chuỗi kết nối, khóa hay mã truy cập (cấu hình chỉ báo "đã đặt / chưa đặt").

/** ok = ổn; warn = cần chú ý; error = hỏng; unknown = chưa bật hoặc chưa đủ thông tin (không tính là lỗi). */
export type SystemCheckState = "ok" | "warn" | "error" | "unknown";

export type SystemCheck = {
  state: SystemCheckState;
  /** Một dòng cho người vận hành đọc. */
  summary: string;
  /** Thời gian phản hồi (ms) khi kiểm tra có gọi ra ngoài. */
  latencyMs?: number;
};

export type SystemDatabase = SystemCheck & {
  /** Ví dụ "PostgreSQL 17.2". */
  version?: string;
  sizeBytes?: number;
  connections?: { used: number; max: number };
};

export type SystemMigrations = SystemCheck & {
  applied?: number;
  /** Số migration trong mã nguồn (đọc drizzle/meta/_journal.json); null nếu image không có tệp này. */
  expected?: number | null;
  lastAppliedAt?: string;
};

export type SystemServer = SystemCheck & {
  uptimeSeconds: number;
  nodeVersion: string;
  platform: string;
  cpuCount: number;
  /** Chỉ có trên Linux/macOS. */
  loadAverage?: [number, number, number];
  memory: { totalBytes: number; freeBytes: number; processBytes: number };
  disk?: { totalBytes: number; freeBytes: number };
};

export type SystemBackup = SystemCheck & { lastSuccessAt?: string; lastFailureAt?: string };

/** Tác vụ định kỳ ghi lần chạy gần nhất vào site_settings (script gọi recordJobRun). */
export const systemJobNames = ["login-throttles", "session-cleanup", "media-cleanup", "content-cleanup"] as const;
export type SystemJobName = (typeof systemJobNames)[number];

/** Lần chạy gần nhất của một tác vụ (JSONB trong site_settings, key system.job.<tên>). */
export const jobRunSchema = z.object({
  finishedAt: z.string().datetime(),
  ok: z.boolean(),
  summary: z.string().max(300),
});
export type JobRun = z.infer<typeof jobRunSchema>;

export type SystemJob = SystemCheck & {
  name: SystemJobName;
  label: string;
  /** Lịch chạy khuyến nghị, hiển thị cho người vận hành. */
  schedule: string;
  lastRunAt?: string;
};

export type SystemConfigItem = {
  key: string;
  label: string;
  ok: boolean;
  /** Thiếu mục bắt buộc thì tình trạng chung là "cần chú ý". */
  required: boolean;
  hint?: string;
  /** Trang CMS để đặt/sửa mục này; chỉ hiện lối tắt khi người xem mở được trang đó. Mục chỉ đặt bằng biến môi trường thì không có. */
  href?: string;
};

export type SystemStatus = {
  checkedAt: string;
  overall: "ok" | "warn" | "error";
  counts: Record<SystemCheckState, number>;
  app: { commit: string | null; environment: string; service: string };
  services: {
    database: SystemDatabase;
    migrations: SystemMigrations;
    storage: SystemCheck;
    website: SystemCheck;
    analytics: SystemCheck;
    searchConsole: SystemCheck;
  };
  server: SystemServer;
  backup: SystemBackup;
  jobs: SystemJob[];
  config: SystemConfigItem[];
};
