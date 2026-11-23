import { eq } from "drizzle-orm";
import type { ZodType } from "zod";

import { getDb } from "@iorder/shared/db/client";
import { auditLogs, siteSettings } from "@iorder/shared/db/schema";

import {
  consultFormSchema,
  defaultConsultForm,
  defaultPromotionPopup,
  promotionPopupSchema,
  storedConsultPopupSchema,
  type ConsultFormSettings,
  type PromotionPopupSettings,
} from "./consult-popup.contract";
import { parseStoredSetting } from "./stored-setting";
import { assertContentVersion, ContentVersionConflictError } from "../shared/content-version";

const legacySettingKey = "consult_popup";
const consultFormKey = "consult_form";
const promotionPopupKey = "promotion_popup";

async function getLegacyPopup() {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, legacySettingKey)).limit(1);
  return row ? parseStoredSetting(storedConsultPopupSchema, row.value, legacySettingKey) : null;
}

async function readIndependentSetting<T>(key: string, schema: ZodType<T>) {
  const [row] = await getDb().select().from(siteSettings).where(eq(siteSettings.key, key)).limit(1);
  return row ? { value: parseStoredSetting(schema, row.value, key), version: row.version } : null;
}

export async function getConsultForm() {
  const stored = await readIndependentSetting(consultFormKey, consultFormSchema);
  if (stored) return stored.value;
  return (await getLegacyPopup())?.form ?? null;
}

export async function getPromotionPopup() {
  const stored = await readIndependentSetting(promotionPopupKey, promotionPopupSchema);
  if (stored) return stored.value;
  return (await getLegacyPopup())?.promo ?? null;
}

export async function getConsultFormWithVersion() {
  const stored = await readIndependentSetting(consultFormKey, consultFormSchema);
  return { form: stored?.value ?? (await getLegacyPopup())?.form ?? null, version: stored?.version ?? 0 };
}

export async function getPromotionPopupWithVersion() {
  const stored = await readIndependentSetting(promotionPopupKey, promotionPopupSchema);
  return { promotion: stored?.value ?? (await getLegacyPopup())?.promo ?? null, version: stored?.version ?? 0 };
}

// Website vẫn nhận một gói để chỉ cần một lần tải dữ liệu dùng chung, nhưng hai phần đã có dữ liệu và lịch hiển thị riêng.
export async function getConsultPopup() {
  const [form, promo] = await Promise.all([getConsultForm(), getPromotionPopup()]);
  if (!form && !promo) return null;
  return { form: form ?? defaultConsultForm, promo: promo ?? defaultPromotionPopup };
}

async function updateSetting<T>({
  action,
  description,
  expectedVersion,
  input,
  key,
  responseKey,
  schema,
  userId,
}: {
  action: string;
  description: string;
  expectedVersion?: number;
  input: unknown;
  key: string;
  responseKey: "form" | "promotion";
  schema: ZodType<T>;
  userId: string;
}) {
  const values = schema.parse(input);
  const version = await getDb().transaction(async (tx) => {
    const [before] = await tx.select().from(siteSettings).where(eq(siteSettings.key, key)).for("update");
    if (expectedVersion !== undefined) assertContentVersion(before?.version ?? 0, expectedVersion);
    const version = (before?.version ?? 0) + 1;
    const [after] = await tx.insert(siteSettings).values({ key, value: values, description, updatedBy: userId, version })
      .onConflictDoUpdate({ target: siteSettings.key, set: { value: values, description, updatedBy: userId, version, updatedAt: new Date() }, setWhere: eq(siteSettings.version, version - 1) }).returning();
    if (!after) throw new ContentVersionConflictError();
    await tx.insert(auditLogs).values({ userId, action, entityType: "site_setting", entityId: after.id, beforeData: before?.value ?? null, afterData: values });
    return after.version;
  });
  return { [responseKey]: values, version } as Record<typeof responseKey, T> & { version: number };
}

export function updateConsultForm(input: unknown, userId: string, expectedVersion?: number) {
  return updateSetting<ConsultFormSettings>({
    action: "consult_form.update",
    description: "Biểu mẫu tư vấn tự hiện trên website",
    expectedVersion,
    input,
    key: consultFormKey,
    responseKey: "form",
    schema: consultFormSchema,
    userId,
  });
}

export function updatePromotionPopup(input: unknown, userId: string, expectedVersion?: number) {
  return updateSetting<PromotionPopupSettings>({
    action: "promotion_popup.update",
    description: "Quảng cáo tự hiện trên website",
    expectedVersion,
    input,
    key: promotionPopupKey,
    responseKey: "promotion",
    schema: promotionPopupSchema,
    userId,
  });
}
