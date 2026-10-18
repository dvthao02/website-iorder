import { validateCoverMedia } from "@iorder/core/server/media/media.service";
import { publishingConfigSchema } from "./publishing.contract";
import { findPublishingConfig, savePublishingConfig } from "./publishing.repository";
import { parseStoredSetting } from "./stored-setting";

const fallback = { siteUrl: null, defaultTitle: null, defaultDescription: null, defaultOgMediaId: null, allowSearchIndexing: false };
export async function getPublishingConfig() { const row = await findPublishingConfig(); return parseStoredSetting(publishingConfigSchema, row?.value ?? fallback, "publishing_config", publishingConfigSchema.parse(fallback)) ?? publishingConfigSchema.parse(fallback); }
// Giá trị và version đọc từ cùng một dòng để CMS không nhận dữ liệu cũ kèm version mới.
export async function getPublishingConfigWithVersion() { const row = await findPublishingConfig(); return { config: parseStoredSetting(publishingConfigSchema, row?.value ?? fallback, "publishing_config", publishingConfigSchema.parse(fallback)) ?? publishingConfigSchema.parse(fallback), version: row?.version ?? 0 }; }
export async function updatePublishingConfig(input: unknown, userId: string, expectedVersion?: number) { const values = publishingConfigSchema.parse(input); await validateCoverMedia(values.defaultOgMediaId); const saved = await savePublishingConfig(values, userId, expectedVersion); return { config: values, version: saved.version }; }
