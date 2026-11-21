import { inArray, sql } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { siteSettings } from "@iorder/shared/db/schema";
import { jobRunSchema, systemJobNames, type JobRun, type SystemJobName } from "./system-status.contract";

// Lần chạy gần nhất của các tác vụ định kỳ (dọn bucket đăng nhập, dọn media, dọn thùng rác nội dung), để màn "Tình trạng hệ thống"
// thấy tác vụ có chạy đều không. Mỗi tác vụ một khóa site_settings; sao lưu có cơ chế riêng (backup-status.ts).

const keyOf = (name: SystemJobName) => `system.job.${name}`;

/** Rút gọn thông điệp về tối đa 300 ký tự một dòng, đúng giới hạn của schema. */
export function summarizeJobMessage(message: string) {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > 300 ? `${oneLine.slice(0, 297)}…` : oneLine;
}

/**
 * Ghi lần chạy gần nhất của một tác vụ. Không bao giờ làm hỏng tác vụ: lỗi khi ghi chỉ trả về false (script vẫn in kết quả như cũ).
 * `summary` là câu kết quả dễ đọc, không chứa dữ liệu nhạy cảm.
 */
export async function recordJobRun(name: SystemJobName, run: { ok: boolean; summary: string }, now = new Date()) {
  const value: JobRun = { finishedAt: now.toISOString(), ok: run.ok, summary: summarizeJobMessage(run.summary) };
  try {
    await getDb().insert(siteSettings).values({ key: keyOf(name), value, description: "Lần chạy gần nhất của tác vụ định kỳ (script tự ghi)" })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value, updatedAt: now, version: sql`${siteSettings.version} + 1` } });
    return true;
  } catch {
    return false;
  }
}

/** Đọc lần chạy gần nhất của mọi tác vụ; giá trị hỏng (không đúng schema) coi như chưa chạy. */
export async function readJobRuns(): Promise<Partial<Record<SystemJobName, JobRun>>> {
  const rows = await getDb().select({ key: siteSettings.key, value: siteSettings.value }).from(siteSettings)
    .where(inArray(siteSettings.key, systemJobNames.map(keyOf)));
  const runs: Partial<Record<SystemJobName, JobRun>> = {};
  for (const name of systemJobNames) {
    const row = rows.find((item) => item.key === keyOf(name));
    const parsed = jobRunSchema.safeParse(row?.value);
    if (parsed.success) runs[name] = parsed.data;
  }
  return runs;
}
