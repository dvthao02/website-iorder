import { z } from "zod";

const optionalUrl = z.string().url().max(1_000).nullable();

export const externalLinksSchema = z.object({
  appLogin: optionalUrl,
  trial: optionalUrl,
  facebook: optionalUrl,
  zalo: optionalUrl,
  youtube: optionalUrl,
  appStore: optionalUrl,
  googlePlay: optionalUrl,
}).strict();

export type ExternalLinks = z.infer<typeof externalLinksSchema>;
