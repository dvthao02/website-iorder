import { createHash } from "node:crypto";
import { publicLeadInputSchema, type LeadStatus } from "./leads.contract";
import { createLead, findRecentLeadByIpHash, listLeads, updateLeadStatus } from "./leads.repository";

const leadRateLimitWindowMs = 15 * 60 * 1000;

function ipFingerprint(ipAddress: string | null) {
  if (!ipAddress) return null;
  return createHash("sha256").update(`${process.env.LEAD_IP_HASH_SALT ?? "iorder-v2"}:${ipAddress}`).digest("hex");
}

export async function submitPublicLead(input: unknown, ipAddress: string | null) {
  const values = publicLeadInputSchema.parse(input);
  const ipHash = ipFingerprint(ipAddress);
  if (ipHash && (await findRecentLeadByIpHash(ipHash, new Date(Date.now() - leadRateLimitWindowMs))).length > 0) return { accepted: false as const };
  const [lead] = await createLead(values, ipHash);
  return { accepted: true as const, id: lead.id };
}

export async function getLeads() { return listLeads(); }
export async function changeLeadStatus(id: string, status: LeadStatus, userId: string) { return updateLeadStatus(id, status, userId); }
