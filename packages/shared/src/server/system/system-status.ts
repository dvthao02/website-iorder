import { readFile, statfs } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";

import { getAnalyticsOverview } from "../analytics/analytics.service";
import { getBackupStatus } from "../backup/backup-status";
import { pingMediaBucket } from "../media/storage";
import { getSearchConsoleOverview } from "../search-console/search-console";
import { getSecretsOverview } from "../secrets/secrets";
import { logger } from "../shared/logger";
import { getPublishingConfig } from "../settings/publishing.service";
import { readJobRuns } from "./job-runs";
import { createSystemStatusService } from "./system-status.service";

export type { SystemStatus } from "./system-status.contract";

/** Số migration trong mã nguồn: đếm entries của drizzle/meta/_journal.json nếu image có tệp này (tìm từ thư mục chạy lên 3 cấp). */
async function countJournalMigrations() {
  for (const base of [".", "..", "../..", "../../.."]) {
    try {
      const journal = JSON.parse(await readFile(path.resolve(process.cwd(), base, "drizzle/meta/_journal.json"), "utf8")) as { entries?: unknown[] };
      if (Array.isArray(journal.entries)) return journal.entries.length;
    } catch {
      // thử thư mục tiếp theo
    }
  }
  return null;
}

async function queryDatabase() {
  const [row] = await getDb().execute(sql`select version() as version, pg_database_size(current_database())::bigint as size,
    (select count(*)::int from pg_stat_activity where datname = current_database()) as used, current_setting('max_connections')::int as max`);
  const info = row as { version: string; size: string | number; used: number; max: number };
  return { version: String(info.version), sizeBytes: Number(info.size), connectionsUsed: Number(info.used), connectionsMax: Number(info.max) };
}

async function queryMigrations() {
  try {
    const [row] = await getDb().execute(sql`select count(*)::int as applied, max(created_at)::bigint as last from drizzle.__drizzle_migrations`);
    const info = row as { applied: number; last: string | number | null };
    return { applied: Number(info.applied), lastAppliedAt: info.last === null || info.last === undefined ? null : new Date(Number(info.last)) };
  } catch {
    return null;
  }
}

async function readDisk() {
  const stats = await statfs(process.cwd());
  return { totalBytes: stats.blocks * stats.bsize, freeBytes: stats.bavail * stats.bsize };
}

// Os.availableMemory (Node mới) tính cả bộ nhớ đệm có thể thu hồi nên sát thực tế hơn os.freemem trên Linux.
const availableMemory = () => (os as { availableMemory?: () => number }).availableMemory?.() ?? os.freemem();

const service = createSystemStatusService({
  now: () => new Date(),
  monotonic: () => performance.now(),
  env: process.env,
  fetch: (...args) => fetch(...args),
  queryDatabase,
  queryMigrations,
  expectedMigrations: countJournalMigrations,
  pingStorage: pingMediaBucket,
  // Umami gọi chưa cấu hình là "not_connected"; thống nhất tên với Search Console.
  analyticsConnection: async () => { const { connection } = await getAnalyticsOverview(); return connection === "not_connected" ? "not_configured" : connection; },
  searchConsoleConnection: async () => (await getSearchConsoleOverview()).connection,
  backup: () => getBackupStatus(),
  jobRuns: readJobRuns,
  publishing: async () => { const config = await getPublishingConfig(); return { siteUrl: config.siteUrl, allowSearchIndexing: config.allowSearchIndexing }; },
  cmsSecrets: async () => {
    const overview = await getSecretsOverview();
    const stored = (key: string) => overview.secrets.some((secret) => secret.key === key && secret.storedInCms);
    return { masterKey: overview.masterKey, configured: { google_service_account: stored("google_service_account"), umami_api_key: stored("umami_api_key"), umami_api_url: stored("umami_api_url"), umami_website_id: stored("umami_website_id") } };
  },
  host: {
    uptimeSeconds: () => process.uptime(),
    totalMemoryBytes: () => os.totalmem(),
    availableMemoryBytes: availableMemory,
    processMemoryBytes: () => process.memoryUsage().rss,
    loadAverage: () => os.loadavg() as [number, number, number],
    cpuCount: () => os.cpus().length,
    nodeVersion: process.version,
    platform: process.platform,
    disk: readDisk,
  },
  log: (message, context) => logger.warn(message, context),
});

/** Tình trạng hệ thống hiện tại (nhớ vài giây để nhiều người mở cùng lúc không gọi dồn). */
export const getSystemStatus = service.getStatus;
