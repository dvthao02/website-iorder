import { z } from "zod";

export const publishingConfigSchema = z.object({
  siteUrl: z.string().url().max(1_000).refine(value => {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  }, "URL website phải dùng HTTP hoặc HTTPS và không chứa thông tin đăng nhập.").nullable(),
  defaultTitle: z.string().trim().min(1).max(220).nullable(),
  defaultDescription: z.string().trim().min(1).max(180).nullable(),
  defaultOgMediaId: z.string().uuid().nullable(),
  allowSearchIndexing: z.boolean(),
}).strict();

export type PublishingConfig = z.infer<typeof publishingConfigSchema>;
