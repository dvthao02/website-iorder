import { createHash } from "node:crypto";
import { getDb } from "@iorder/core/db/client";
import { leadExportQuerySchema, leadListQuerySchema, publicLeadInputSchema, type LeadStatus } from "./leads.contract";
import { leadsToCsv } from "./leads.csv";
import { createRateLimitedLead, listLeadsForExport, listLeadsPage, updateLeadStatus } from "./leads.repository";

const leadRateLimitWindowMs = 15 * 60 * 1000;

function ipFingerprint(ipAddress: string | null) {
  if (!ipAddress) return null;
  return createHash("sha256").update(`${process.env.LEAD_IP_HASH_SALT ?? "iorder-v2"}:${ipAddress}`).digest("hex");
}

export async function submitPublicLead(input: unknown, ipAddress: string | null, database: ReturnType<typeof getDb> = getDb()) {
  const values = publicLeadInputSchema.parse(input);
  const ipHash = ipFingerprint(ipAddress);
  const lead = await createRateLimitedLead(values, ipHash, new Date(Date.now() - leadRateLimitWindowMs), database);
  if (!lead) return { accepted: false as const };
  return { accepted: true as const, id: lead.id };
}

export async function getLeadsPage(input: unknown) { return listLeadsPage(leadListQuerySchema.parse(input)); }

export const leadExportRowLimit = 10_000;
/** CSV khách hàng tiềm năng theo bộ lọc; tối đa 10.000 dòng mới nhất. */
export async function exportLeadsCsv(input: unknown, actorId: string) {
  const rows = await listLeadsForExport(leadExportQuerySchema.parse(input), actorId, leadExportRowLimit);
  return { csv: leadsToCsv(rows), rows: rows.length };
}
export async function changeLeadStatus(id: string, status: LeadStatus, userId: string) { return updateLeadStatus(id, status, userId); }
