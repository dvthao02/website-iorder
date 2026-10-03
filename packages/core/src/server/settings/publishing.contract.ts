import { z } from "zod";

export const publishingConfigSchema = z.object({
  siteUrl: z.string().url().max(1_000).nullable(),
  defaultTitle: z.string().trim().min(1).max(220).nullable(),
  defaultDescription: z.string().trim().min(1).max(180).nullable(),
  defaultOgMediaId: z.string().uuid().nullable(),
  allowSearchIndexing: z.boolean(),
}).strict();

export type PublishingConfig = z.infer<typeof publishingConfigSchema>;
