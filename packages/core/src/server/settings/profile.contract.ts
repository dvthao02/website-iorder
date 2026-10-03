import { z } from "zod";

export const profileInputSchema = z.object({
  companyName: z.string().trim().min(1).max(220),
  legalName: z.string().trim().max(220).nullable(),
  hotline: z.string().trim().max(60).nullable(),
  supportEmail: z.string().email().max(320).nullable(),
  salesEmail: z.string().email().max(320).nullable(),
  address: z.string().trim().max(5000).nullable(),
  workingHours: z.string().trim().max(255).nullable(),
  logoMediaId: z.string().uuid().nullable(),
}).strict();

export type ProfileInput = z.infer<typeof profileInputSchema>;
