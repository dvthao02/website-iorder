"use client";

import { useEffect, useRef, useState } from "react";
import type { ZodIssue } from "zod";

type FieldDefinition = { label: string; message: string };
export type AdminFormValidation<Field extends string> = ReturnType<typeof useAdminFormValidation<Field>>;

/** Hiện lỗi từ contract Zod bằng lời hướng dẫn tiếng Việt và giữ bản nhập trên form. */
export function useAdminFormValidation<Field extends string>(formId: string, fields: Record<Field, FieldDefinition>) {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  const entries = Object.entries(errors) as Array<[Field, string]>;

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    summaryRef.current?.focus();
  }, [errors]);

  function report(issues: readonly ZodIssue[], prefix?: string) {
    const next: Partial<Record<Field, string>> = {};
    for (const issue of issues) {
      if (prefix && issue.path[0] !== prefix) continue;
      const key = issue.path[prefix ? 1 : 0];
      if (typeof key !== "string" || !(key in fields)) continue;
      const field = key as Field;
      next[field] ??= issue.code === "custom" ? issue.message : fields[field].message;
    }
    setErrors(next);
    focusPending.current = true;
  }

  function props(field: Field) {
    return { id: `${formId}-${field}`, "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? `${formId}-${field}-error` : undefined };
  }

  function message(field: Field) {
    return errors[field] ? <span className="admin-form-error" id={`${formId}-${field}-error`}>{errors[field]}</span> : null;
  }

  const summary = entries.length ? <div aria-labelledby={`${formId}-errors-title`} className="admin-form-errors" ref={summaryRef} role="alert" tabIndex={-1}>
    <p id={`${formId}-errors-title`}><strong>Kiểm tra thông tin trước khi lưu</strong></p>
    <ul>{entries.map(([field, error]) => <li key={field}><a href={`#${formId}-${field}`} onClick={(event) => { event.preventDefault(); document.getElementById(`${formId}-${field}`)?.focus(); }}>{fields[field].label}: {error}</a></li>)}</ul>
  </div> : null;

  return { props, message, summary, report, reset: () => setErrors({}) };
}
