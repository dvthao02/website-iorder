import type { BackupStatus } from "../backup/backup-status";
import {
  systemJobNames,
  type JobRun, type SystemBackup, type SystemCheck, type SystemCheckState, type SystemConfigItem, type SystemDatabase, type SystemJob,
  type SystemJobName, type SystemMigrations, type SystemServer, type SystemStatus,
} from "./system-status.contract";

// Gom tình trạng vận hành của hệ thống cho người có quyền system.view. Mọi kiểm tra chạy song song, có giới hạn thời gian riêng và không bao giờ
// ném lỗi ra ngoài (lỗi → trạng thái "error"/"warn" kèm câu giải thích chung; chi tiết kỹ thuật chỉ ghi log phía máy chủ). Kết quả
// không chứa giá trị biến môi trường, chuỗi kết nối hay khóa: cấu hình chỉ báo "đã đặt / chưa đặt".

const defaultTimeoutMilliseconds = 5_000;
const cacheMilliseconds = 5_000;
const slowDatabaseMilliseconds = 1_000;
const slowStorageMilliseconds = 1_500;
const connectionsWarnRatio = 0.8;
const diskWarnRatio = 0.15;
const diskErrorRatio = 0.05;
const memoryWarnRatio = 0.07;
const hourMilliseconds = 3_600_000;

type JobDefinition = { label: string; schedule: string; staleAfterHours: number | null };
/** Tần suất theo docs/PROJECT.md mục Vận hành: bucket đăng nhập và phiên hết hạn hằng ngày; dọn media và thùng rác chạy tay (chưa lên lịch). */
export const systemJobDefinitions: Record<SystemJobName, JobDefinition> = {
  "login-throttles": { label: "Dọn bucket đăng nhập hết hạn", schedule: "Hằng ngày (pnpm db:cleanup-login-throttles)", staleAfterHours: 36 },
  "session-cleanup": { label: "Dọn phiên đăng nhập hết hạn", schedule: "Hằng ngày (pnpm db:cleanup-sessions)", staleAfterHours: 36 },
  "media-cleanup": { label: "Dọn media đã xóa", schedule: "Thủ công (pnpm db:cleanup-media)", staleAfterHours: null },
  "content-cleanup": { label: "Dọn thùng rác nội dung", schedule: "Thủ công (pnpm db:cleanup-content --apply)", staleAfterHours: null },
};

export type SystemStatusDependencies = {
  now: () => Date;
  /** Đồng hồ đơn điệu (ms) để đo thời gian phản hồi. */
  monotonic: () => number;
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  /** Ném lỗi khi không kết nối được. */
  queryDatabase: () => Promise<{ version: string; sizeBytes: number; connectionsUsed: number; connectionsMax: number }>;
  /** null khi không đọc được bảng migration (ví dụ chưa chạy migrate hoặc dùng cách khác). */
  queryMigrations: () => Promise<{ applied: number; lastAppliedAt: Date | null } | null>;
  /** Số migration trong mã nguồn; null nếu không có tệp journal trong image. */
  expectedMigrations: () => Promise<number | null>;
  pingStorage: () => Promise<void>;
  analyticsConnection: () => Promise<"connected" | "not_configured" | "error">;
  searchConsoleConnection: () => Promise<"connected" | "not_configured" | "error">;
  backup: () => Promise<BackupStatus>;
  jobRuns: () => Promise<Partial<Record<SystemJobName, JobRun>>>;
  publishing: () => Promise<{ siteUrl: string | null | undefined; allowSearchIndexing: boolean }>;
  /** Khóa API nhập ở CMS (Cài đặt → Kết nối & khóa API): khóa chủ có hợp lệ không và khóa nào đã lưu. Không có giá trị khóa. */
  cmsSecrets: () => Promise<{ masterKey: "ok" | "missing" | "invalid"; configured: { google_service_account: boolean; umami_api_key: boolean; umami_api_url?: boolean; umami_website_id?: boolean } }>;
  host: {
    uptimeSeconds: () => number;
    totalMemoryBytes: () => number;
    availableMemoryBytes: () => number;
    processMemoryBytes: () => number;
    loadAverage: () => [number, number, number];
    cpuCount: () => number;
    nodeVersion: string;
    platform: string;
    disk: () => Promise<{ totalBytes: number; freeBytes: number } | null>;
  };
  log: (message: string, context?: Record<string, unknown>) => void;
  timeoutMilliseconds?: number;
};

const percent = (ratio: number) => `${Math.max(0, Math.round(ratio * 100))}%`;

const worst = (states: SystemCheckState[]): SystemCheckState => states.includes("error") ? "error" : states.includes("warn") ? "warn" : states.includes("ok") ? "ok" : "unknown";

export function createSystemStatusService(dependencies: SystemStatusDependencies) {
  const { now, monotonic, env, host } = dependencies;
  const timeout = dependencies.timeoutMilliseconds ?? defaultTimeoutMilliseconds;

  /** Chạy một việc có giới hạn thời gian; quá hạn thì coi như lỗi. */
  function within<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const limit = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Quá thời gian chờ.")), timeout); });
    return Promise.race([work, limit]).finally(() => clearTimeout(timer));
  }

  const elapsed = (started: number) => Math.max(0, Math.round(monotonic() - started));

  async function checkDatabase(): Promise<SystemDatabase> {
    const started = monotonic();
    try {
      const info = await within(dependencies.queryDatabase());
      const latencyMs = elapsed(started);
      const ratio = info.connectionsMax > 0 ? info.connectionsUsed / info.connectionsMax : 0;
      const version = info.version.match(/^PostgreSQL\s+[\d.]+/)?.[0];
      const base = { latencyMs, version, sizeBytes: info.sizeBytes, connections: { used: info.connectionsUsed, max: info.connectionsMax } };
      if (ratio >= connectionsWarnRatio) return { ...base, state: "warn", summary: `Gần hết kết nối: đang dùng ${info.connectionsUsed}/${info.connectionsMax}.` };
      if (latencyMs > slowDatabaseMilliseconds) return { ...base, state: "warn", summary: `Phản hồi chậm (${latencyMs} ms).` };
      return { ...base, state: "ok", summary: `Kết nối tốt, phản hồi ${latencyMs} ms.` };
    } catch (error) {
      dependencies.log("Tình trạng hệ thống: không kiểm tra được database.", { error });
      return { state: "error", summary: "Không kết nối được database. Nội dung và đăng nhập sẽ lỗi." };
    }
  }

  async function checkMigrations(): Promise<SystemMigrations> {
    try {
      const [applied, expected] = await Promise.all([within(dependencies.queryMigrations()), within(dependencies.expectedMigrations()).catch(() => null)]);
      if (!applied) return { state: "unknown", summary: "Chưa đọc được bảng migration (chưa chạy migrate?).", expected };
      const lastAppliedAt = applied.lastAppliedAt?.toISOString();
      if (expected !== null && applied.applied < expected) {
        return { state: "warn", summary: `Còn ${expected - applied.applied} migration chưa áp dụng (${applied.applied}/${expected}). Chạy lại dịch vụ migrate.`, applied: applied.applied, expected, lastAppliedAt };
      }
      return { state: "ok", summary: expected === null ? `Đã áp dụng ${applied.applied} migration.` : `Đã áp dụng đủ ${applied.applied}/${expected} migration.`, applied: applied.applied, expected, lastAppliedAt };
    } catch (error) {
      dependencies.log("Tình trạng hệ thống: không đọc được migration.", { error });
      return { state: "unknown", summary: "Không đọc được trạng thái migration." };
    }
  }

  async function checkStorage(): Promise<SystemCheck> {
    const started = monotonic();
    try {
      await within(dependencies.pingStorage());
      const latencyMs = elapsed(started);
      return latencyMs > slowStorageMilliseconds
        ? { state: "warn", summary: `Kho tệp phản hồi chậm (${latencyMs} ms).`, latencyMs }
        : { state: "ok", summary: `Kho tệp (S3) hoạt động, phản hồi ${latencyMs} ms.`, latencyMs };
    } catch (error) {
      dependencies.log("Tình trạng hệ thống: không kiểm tra được kho tệp.", { error });
      return { state: "error", summary: "Không kết nối được kho tệp (S3). Ảnh và tệp tải lên sẽ lỗi." };
    }
  }

  async function checkWebsite(): Promise<SystemCheck> {
    const url = env.PUBLISH_WEB_REVALIDATE_URL?.trim();
    if (!url) return { state: "unknown", summary: "Chưa đặt PUBLISH_WEB_REVALIDATE_URL nên chưa kiểm tra được website." };
    let origin: string;
    try { origin = new URL(url).origin; } catch { return { state: "warn", summary: "PUBLISH_WEB_REVALIDATE_URL không phải địa chỉ hợp lệ." }; }
    const started = monotonic();
    try {
      const response = await within(dependencies.fetch(`${origin}/api/health`, { cache: "no-store", signal: AbortSignal.timeout(timeout) }));
      const latencyMs = elapsed(started);
      return response.ok
        ? { state: "ok", summary: `Website phản hồi tốt (${latencyMs} ms).`, latencyMs }
        : { state: "error", summary: `Website trả lỗi HTTP ${response.status}.`, latencyMs };
    } catch (error) {
      dependencies.log("Tình trạng hệ thống: không kiểm tra được website.", { error });
      return { state: "error", summary: "Không kết nối được website." };
    }
  }

  /** Tích hợp tùy chọn: chưa bật thì trung tính ("unknown"), đang lỗi thì chỉ cảnh báo vì không làm website ngừng chạy. */
  async function checkIntegration(read: () => Promise<"connected" | "not_configured" | "error">, name: string, off: string): Promise<SystemCheck> {
    try {
      const connection = await within(read());
      if (connection === "connected") return { state: "ok", summary: `${name} đang nối và trả số liệu.` };
      if (connection === "not_configured") return { state: "unknown", summary: off };
      return { state: "warn", summary: `${name} đang lỗi. Xem chi tiết ở màn riêng của nó.` };
    } catch (error) {
      dependencies.log(`Tình trạng hệ thống: không kiểm tra được ${name}.`, { error });
      return { state: "warn", summary: `Không kiểm tra được ${name}.` };
    }
  }

  async function checkBackup(): Promise<SystemBackup> {
    try {
      const backup = await within(dependencies.backup());
      const lastSuccessAt = backup.lastSuccess?.finishedAt.toISOString();
      const lastFailureAt = backup.lastFailure?.failedAt.toISOString();
      const base = { lastSuccessAt, lastFailureAt };
      if (backup.state === "ok") return { ...base, state: "ok", summary: "Có bản sao lưu gần đây và đã khôi phục thử." };
      if (backup.state === "stale") return { ...base, state: "warn", summary: "Hơn 36 giờ chưa có bản sao lưu mới: kiểm tra lịch chạy sao lưu." };
      if (backup.state === "failed") return { ...base, state: "error", summary: "Lần sao lưu gần nhất bị lỗi." };
      return { ...base, state: "warn", summary: "Chưa có bản sao lưu nào được ghi nhận." };
    } catch (error) {
      dependencies.log("Tình trạng hệ thống: không đọc được trạng thái sao lưu.", { error });
      return { state: "unknown", summary: "Không đọc được trạng thái sao lưu." };
    }
  }

  async function checkJobs(): Promise<SystemJob[]> {
    let runs: Partial<Record<SystemJobName, JobRun>> = {};
    let readable = true;
    try { runs = await within(dependencies.jobRuns()); } catch (error) { readable = false; dependencies.log("Tình trạng hệ thống: không đọc được lần chạy tác vụ.", { error }); }
    return systemJobNames.map((name): SystemJob => {
      const definition = systemJobDefinitions[name];
      const base = { name, label: definition.label, schedule: definition.schedule };
      if (!readable) return { ...base, state: "unknown", summary: "Không đọc được lần chạy gần nhất." };
      const run = runs[name];
      if (!run) return { ...base, state: "unknown", summary: "Chưa ghi nhận lần chạy nào." };
      const lastRunAt = run.finishedAt;
      if (!run.ok) return { ...base, lastRunAt, state: "warn", summary: `Lần chạy gần nhất bị lỗi: ${run.summary}` };
      const hoursSince = (now().getTime() - new Date(run.finishedAt).getTime()) / hourMilliseconds;
      if (definition.staleAfterHours !== null && hoursSince > definition.staleAfterHours) return { ...base, lastRunAt, state: "warn", summary: `Hơn ${definition.staleAfterHours} giờ chưa chạy lại: kiểm tra lịch chạy.` };
      return { ...base, lastRunAt, state: "ok", summary: run.summary };
    });
  }

  async function checkServer(): Promise<SystemServer> {
    const totalBytes = host.totalMemoryBytes();
    const freeBytes = host.availableMemoryBytes();
    const disk = await within(host.disk()).catch((error: unknown) => { dependencies.log("Tình trạng hệ thống: không đọc được dung lượng ổ đĩa.", { error }); return null; });
    const load = host.loadAverage();
    const memoryRatio = totalBytes > 0 ? freeBytes / totalBytes : 1;
    const diskRatio = disk && disk.totalBytes > 0 ? disk.freeBytes / disk.totalBytes : null;
    const states: SystemCheckState[] = [];
    const parts: string[] = [];
    if (diskRatio !== null) {
      states.push(diskRatio < diskErrorRatio ? "error" : diskRatio < diskWarnRatio ? "warn" : "ok");
      parts.push(`ổ đĩa còn ${percent(diskRatio)} trống`);
    }
    states.push(memoryRatio < memoryWarnRatio ? "warn" : "ok");
    parts.push(`RAM còn ${percent(memoryRatio)} khả dụng`);
    const state = worst(states);
    const lead = state === "error" ? "Ổ đĩa gần đầy" : state === "warn" ? "Tài nguyên máy chủ đang thấp" : "Tài nguyên máy chủ ổn";
    return {
      state, summary: `${lead}: ${parts.join(", ")}.`,
      uptimeSeconds: Math.round(host.uptimeSeconds()), nodeVersion: host.nodeVersion, platform: host.platform, cpuCount: host.cpuCount(),
      // Windows không có load average (luôn 0,0,0): bỏ để khỏi hiển thị số vô nghĩa.
      ...(host.platform === "win32" ? {} : { loadAverage: load }),
      memory: { totalBytes, freeBytes, processBytes: host.processMemoryBytes() },
      ...(disk ? { disk } : {}),
    };
  }

  async function buildConfig(): Promise<SystemConfigItem[]> {
    const set = (name: string) => Boolean(env[name]?.trim());
    const publishing = await within(dependencies.publishing()).catch(() => null);
    const stored = await within(dependencies.cmsSecrets()).catch(() => ({ masterKey: "missing" as const, configured: { google_service_account: false, umami_api_key: false, umami_api_url: false, umami_website_id: false } }));
    const production = env.NODE_ENV === "production";
    return [
      { key: "revalidate-secret", label: "Khóa làm mới website (PUBLISH_WEB_REVALIDATE_SECRET)", ok: set("PUBLISH_WEB_REVALIDATE_SECRET"), required: production, hint: "Thiếu thì website chỉ cập nhật nội dung sau 60 giây và xem trước bản nháp không dùng được." },
      { key: "revalidate-url", label: "Địa chỉ làm mới website (PUBLISH_WEB_REVALIDATE_URL)", ok: set("PUBLISH_WEB_REVALIDATE_URL"), required: production },
      { key: "site-url", label: "Địa chỉ website chính thức (Cài đặt → Tên miền & SEO)", ok: Boolean(publishing?.siteUrl), required: production, hint: "Thiếu thì sitemap, canonical và Search Console không hoạt động đúng." },
      { key: "indexing", label: "Cho phép công cụ tìm kiếm lập chỉ mục", ok: publishing?.allowSearchIndexing === true, required: false, hint: "Đang tắt thì website bị ẩn khỏi Google. Chỉ nên tắt khi website chưa chính thức." },
      { key: "backup-dir", label: "Thư mục sao lưu (BACKUP_DIR hoặc BACKUP_LOCAL_DIR)", ok: set("BACKUP_DIR") || set("BACKUP_LOCAL_DIR"), required: false, hint: "Chỉ để tham khảo: biến này nằm ở máy chạy script sao lưu." },
      { key: "secrets-master-key", label: "Khóa chủ mã hóa khóa API (SECRETS_MASTER_KEY)", ok: stored.masterKey === "ok", required: false, hint: stored.masterKey === "invalid" ? "Đã đặt nhưng sai định dạng: cần base64 của 32 byte (openssl rand -base64 32)." : "Chưa đặt thì không lưu được khóa API ở CMS (Cài đặt → Kết nối & khóa API); vẫn dùng được biến môi trường." },
      { key: "analytics", label: "Thống kê truy cập (Umami)", ok: (set("UMAMI_API_URL") || stored.configured.umami_api_url === true) && (set("UMAMI_WEBSITE_ID") || stored.configured.umami_website_id === true) && (set("UMAMI_API_KEY") || stored.configured.umami_api_key), required: false },
      { key: "search-console", label: "Google Search Console", ok: set("GOOGLE_SERVICE_ACCOUNT_JSON") || set("GOOGLE_SERVICE_ACCOUNT_FILE") || stored.configured.google_service_account, required: false },
      { key: "app-commit", label: "Mã phiên bản (APP_COMMIT)", ok: set("APP_COMMIT"), required: false, hint: "Đặt khi triển khai để biết đang chạy bản nào." },
    ];
  }

  const safeCommit = (value: string | undefined) => (value && /^[0-9A-Za-z._-]{1,40}$/.test(value.trim()) ? value.trim() : null);

  async function build(): Promise<SystemStatus> {
    const [database, migrations, storage, website, analytics, searchConsole, backup, jobs, server, config] = await Promise.all([
      checkDatabase(), checkMigrations(), checkStorage(), checkWebsite(),
      checkIntegration(dependencies.analyticsConnection, "Thống kê Umami", "Chưa nối Umami (không bắt buộc)."),
      checkIntegration(dependencies.searchConsoleConnection, "Google Search Console", "Chưa nối Google Search Console (không bắt buộc)."),
      checkBackup(), checkJobs(), checkServer(), buildConfig(),
    ]);
    const configState: SystemCheckState = config.some((item) => item.required && !item.ok) ? "warn" : "ok";
    const states = [database.state, migrations.state, storage.state, website.state, analytics.state, searchConsole.state, backup.state, server.state, configState, ...jobs.map((job) => job.state)];
    const counts: Record<SystemCheckState, number> = { ok: 0, warn: 0, error: 0, unknown: 0 };
    for (const state of states) counts[state] += 1;
    return {
      checkedAt: now().toISOString(),
      overall: counts.error > 0 ? "error" : counts.warn > 0 ? "warn" : "ok",
      counts,
      app: { commit: safeCommit(env.APP_COMMIT), environment: env.NODE_ENV?.trim() || "development", service: env.SERVICE_NAME?.trim() || "api" },
      services: { database, migrations, storage, website, analytics, searchConsole },
      server, backup, jobs, config,
    };
  }

  // Nhiều người mở màn cùng lúc hoặc tự làm mới chỉ chạy kiểm tra một lần mỗi vài giây.
  let pending: Promise<SystemStatus> | undefined;
  let cached: { value: SystemStatus; at: number } | undefined;
  async function getStatus(options: { fresh?: boolean } = {}): Promise<SystemStatus> {
    if (!options.fresh && cached && now().getTime() - cached.at < cacheMilliseconds) return cached.value;
    pending ??= build().then((value) => { cached = { value, at: now().getTime() }; return value; }).finally(() => { pending = undefined; });
    return pending;
  }

  return { getStatus };
}
