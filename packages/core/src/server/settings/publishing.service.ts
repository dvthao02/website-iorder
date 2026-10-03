import { validateCoverMedia } from "@iorder/core/server/media/media.service";
import { publishingConfigSchema } from "./publishing.contract";
import { findPublishingConfig, savePublishingConfig } from "./publishing.repository";

const fallback = { siteUrl: null, defaultTitle: null, defaultDescription: null, defaultOgMediaId: null, allowSearchIndexing: false };
export async function getPublishingConfig() { const row = await findPublishingConfig(); return publishingConfigSchema.parse(row?.value ?? fallback); }
export async function updatePublishingConfig(input: unknown, userId: string) { const values = publishingConfigSchema.parse(input); await validateCoverMedia(values.defaultOgMediaId); await savePublishingConfig(values, userId); return values; }
