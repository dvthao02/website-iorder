import { createHash } from "node:crypto";
import { getDb } from "@iorder/shared/db/client";
import { leadExportQuerySchema, leadListQuerySchema, leadMergeSchema, publicLeadInputSchema, type LeadUpdate } from "./leads.contract";
import { leadsToCsv, leadsToXlsx } from "./leads.csv";
import { checkLeadToken, issueLeadToken } from "./leads.guard";
import { createRateLimitedLead, deleteLead, findLeadEquipment, getLeadDetail, listLeadsForExport, listLeadsPage, mergeLeads, updateLead, type LeadValues } from "./leads.repository";

function ipFingerprint(ipAddress: string | null) {
  if (!ipAddress) return null;
  return createHash("sha256").update(`${process.env.LEAD_IP_HASH_SALT ?? "iorder-v2"}:${ipAddress}`).digest("hex");
}

/** Mã phiên gửi cho biểu mẫu website (GET /api/v1/leads): ký bằng HMAC, ghi giờ cấp. Xem leads.guard.ts. */
export function newLeadToken() { return issueLeadToken(); }

export type SubmitLeadResult =
  | { accepted: true; duplicate: boolean; discarded: boolean }
  | { accepted: false; kind: "rate_limited"; retryAfterSeconds: number; scope: "ip" | "phone" | "cooldown" }
  | { accepted: false; kind: "same_device" }
  | { accepted: false; kind: "token"; reason: "invalid" | "expired" | "too_fast"; retryAfterSeconds?: number };

/**
 * Nhận liên hệ từ website. Thứ tự: dữ liệu hợp lệ (ném ZodError) → ô bẫy → mã phiên → tra thiết bị khách hỏi mua → giới hạn IP, số điện thoại
 * và liên hệ trùng (leads.repository.ts). Ô bẫy có chữ: báo đã nhận nhưng không lưu gì, để bot không biết mình bị chặn mà đổi cách.
 */
export async function submitPublicLead(input: unknown, ipAddress: string | null, database: ReturnType<typeof getDb> = getDb()): Promise<SubmitLeadResult> {
  const { website, token, equipmentSlug, ...lead } = publicLeadInputSchema.parse(input);
  if (website?.trim()) return { accepted: true, duplicate: false, discarded: true };
  const check = checkLeadToken(token);
  if (!check.ok) return { accepted: false, kind: "token", reason: check.reason, ...(check.reason === "too_fast" ? { retryAfterSeconds: check.retryAfterSeconds } : {}) };
  const context = equipmentSlug ? await findLeadEquipment(equipmentSlug, database) : null;
  const result = await createRateLimitedLead(lead satisfies LeadValues, ipFingerprint(ipAddress), context, database);
  if (!result.accepted) return result.reason === "same_device" ? { accepted: false, kind: "same_device" } : { accepted: false, kind: "rate_limited", retryAfterSeconds: result.retryAfterSeconds, scope: result.scope };
  return { accepted: true, duplicate: result.duplicate, discarded: false };
}

/** Danh sách liên hệ; `actorId` là tài khoản đang xem (cho bộ lọc "của tôi"). */
export async function getLeadsPage(input: unknown, actorId: string | null = null) { return listLeadsPage(leadListQuerySchema.parse(input), getDb(), actorId); }

/** Một liên hệ cho khung chi tiết (mở từ thông báo); undefined nếu không có hoặc đã xóa. */
export async function getLead(id: string) { return getLeadDetail(id); }

export const leadExportRowLimit = 10_000;
/** Khách hàng tiềm năng theo bộ lọc, dạng CSV hoặc Excel; tối đa 10.000 dòng. */
export async function exportLeads(input: unknown, actorId: string) {
  const query = leadExportQuerySchema.parse(input);
  const rows = await listLeadsForExport(query, actorId, leadExportRowLimit);
  return query.format === "xlsx"
    ? { body: leadsToXlsx(rows), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extension: "xlsx", rows: rows.length }
    : { body: leadsToCsv(rows), contentType: "text/csv; charset=utf-8", extension: "csv", rows: rows.length };
}
/** Đổi trạng thái, ghi chú nội bộ và/hoặc người phụ trách của liên hệ; undefined nếu không có liên hệ. Người được giao sai thì ném LeadAssigneeError. */
export async function changeLead(id: string, patch: LeadUpdate, userId: string) { return updateLead(id, patch, userId); }

/** Xóa liên hệ rác (ẩn khỏi CMS và xóa thông tin cá nhân của khách); undefined nếu không có hoặc đã xóa. */
export async function removeLead(id: string, userId: string) { return deleteLead(id, userId); }

/** Gộp các liên hệ cùng số điện thoại (ZodError nếu danh sách sai, LeadMergeError nếu không gộp được). */
export async function mergeLeadGroup(input: unknown, userId: string) { return mergeLeads(leadMergeSchema.parse(input).ids, userId); }
