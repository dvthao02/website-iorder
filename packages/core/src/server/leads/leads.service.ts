import { createHash } from "node:crypto";
import { getDb } from "@iorder/core/db/client";
import { leadListQuerySchema, publicLeadInputSchema, type LeadStatus } from "./leads.contract";
import { createRateLimitedLead, listLeadsPage, updateLeadStatus } from "./leads.repository";

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
export async function changeLeadStatus(id: string, status: LeadStatus, userId: string) { return updateLeadStatus(id, status, userId); }
