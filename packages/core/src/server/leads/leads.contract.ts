import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);

export const publicLeadInputSchema = z.object({
  name: z.string().trim().min(2).max(180),
  phone: z.string().trim().min(8).max(30).regex(/^[0-9+(). -]+$/),
  email: z.string().trim().email().max(320).or(z.literal("")).transform((value) => value || null),
  businessModel: optionalText(120),
  branches: optionalText(60),
  need: optionalText(200),
  message: optionalText(5_000),
  website: z.string().max(0).optional(),
}).strict();

export const leadStatusSchema = z.enum(["new", "contacted", "closed"]);
export const leadStatusUpdateSchema = z.object({ status: leadStatusSchema }).strict();

export type PublicLeadInput = z.infer<typeof publicLeadInputSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
