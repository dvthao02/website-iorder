"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ZodType } from "zod";

import { adminApiError, readAdminJson } from "@/lib/admin-api";
import { expectedVersionSchema } from "@iorder/shared/server/shared/content-version";
import { useAdminToast } from "./ui/admin-feedback";
import { useAdminFormValidation } from "./ui/use-admin-form-validation";
import { useAdminPermissions } from "./ui/admin-permissions";
import { useNavigationGuard } from "./ui/use-navigation-guard";
import { useUnsavedChanges } from "./ui/use-unsaved-changes";

export type PopupDisplay = { scrollPercent: number; delaySeconds: number; repeatDays: number; scope: "all" | "home" };
export type TimingPreset = "balanced" | "late" | "custom";

export const timingPresets: Record<Exclude<TimingPreset, "custom">, Pick<PopupDisplay, "scrollPercent" | "delaySeconds" | "repeatDays">> = {
  balanced: { scrollPercent: 60, delaySeconds: 5, repeatDays: 7 },
  late: { scrollPercent: 85, delaySeconds: 8, repeatDays: 3 },
};

export function getTimingPreset(value: PopupDisplay): TimingPreset {
  for (const [preset, settings] of Object.entries(timingPresets)) {
    if (value.scrollPercent === settings.scrollPercent && value.delaySeconds === settings.delaySeconds && value.repeatDays === settings.repeatDays) return preset as TimingPreset;
  }
  return "custom";
}

type FieldDefinitions<Value> = Record<Extract<keyof Value, string>, { label: string; message: string }>;

type Options<Value extends PopupDisplay> = {
  /** Đường dẫn API của cài đặt, ví dụ `/api/v1/admin/consult-form`. */
  endpoint: string;
  /** Khóa chứa giá trị đã lưu trong phản hồi của API. */
  responseKey: "form" | "promotion";
  schema: ZodType<Value>;
  /** Giá trị đã lưu; null khi chưa lưu lần nào (dùng `fallback`). */
  initial: Value | null;
  fallback: Value;
  initialVersion: number;
  /** Tên tính năng viết thường, dùng trong thông báo: "biểu mẫu tư vấn", "quảng cáo". */
  subject: string;
  formId: string;
  fields: FieldDefinitions<Value>;
  /** Chuẩn hóa giá trị ngay trước khi kiểm tra và gửi (ví dụ cắt khoảng trắng). */
  prepare?: (value: Value) => unknown;
  /** Việc chạy nền chưa xong (ví dụ đang tải ảnh) thì chưa cho lưu hoặc rời trang. */
  pending?: boolean;
};

/**
 * Phần lưu chung của hai màn Biểu mẫu tư vấn và Quảng cáo: khóa phiên bản (HTTP 409), thay đổi chưa lưu,
 * kiểm tra bằng schema dùng chung với Backend và thông báo. Mỗi màn chỉ còn phần giao diện riêng của mình.
 */
export function usePopupSettingEditor<Value extends PopupDisplay>({ endpoint, responseKey, schema, initial, fallback, initialVersion, subject, formId, fields, prepare, pending = false }: Options<Value>) {
  const version = useRef(initialVersion);
  const saving = useRef(false);
  const { can } = useAdminPermissions();
  const canUpdate = can("settings.update");
  const [value, setValue] = useState<Value>(initial ?? fallback);
  const [timingMode, setTimingMode] = useState<TimingPreset>(() => getTimingPreset(initial ?? fallback));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { isDirty, markSaved, getSavedValue } = useUnsavedChanges(value);
  const { show: showToast } = useAdminToast();
  const validation = useAdminFormValidation<Extract<keyof Value, string>>(formId, fields);
  useNavigationGuard(busy || pending, () => showToast(`Đang lưu ${subject}. Vui lòng chờ trước khi rời trang.`, "info"));

  const update = <Key extends keyof Value>(key: Key, next: Value[Key]) => setValue((current) => ({ ...current, [key]: next }));
  const locked = busy || !canUpdate;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !canUpdate || !isDirty || pending) return;
    const parsed = schema.safeParse(prepare ? prepare(value) : value);
    if (!parsed.success) { validation.report(parsed.error.issues); return; }
    validation.reset(); setMessage(""); saving.current = true; setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed.data, expectedVersion: version.current }) });
      const body: unknown = await readAdminJson(response);
      if (!response.ok) throw adminApiError(body, `Không thể lưu ${subject}.`);
      const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
      const savedValue = schema.safeParse(record[responseKey]);
      const savedVersion = expectedVersionSchema.safeParse(record.version);
      if (!savedValue.success || !savedVersion.success) throw new Error(`Phản hồi lưu ${subject} không hợp lệ. Hãy tải lại trước khi lưu tiếp.`);
      version.current = savedVersion.data; setValue(savedValue.data); setTimingMode(getTimingPreset(savedValue.data)); markSaved(savedValue.data);
      showToast(`Đã cập nhật ${subject} trên website.`, "success");
    } catch (error) {
      const notice = error instanceof Error ? error.message : "Không kết nối được máy chủ."; setMessage(notice); showToast(notice, "error");
    } finally { saving.current = false; setBusy(false); }
  }

  function discard() {
    const saved = getSavedValue();
    setValue(saved); setTimingMode(getTimingPreset(saved)); setMessage(""); validation.reset();
  }

  return { value, update, timingMode, setTimingMode, busy, locked, canUpdate, message, isDirty, save, discard, validation };
}
