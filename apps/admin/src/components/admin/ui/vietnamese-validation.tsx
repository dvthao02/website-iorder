"use client";

import { useEffect } from "react";

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Bảng thông báo xác thực của trình duyệt. Sau này thay bằng bộ i18n mà không phải sửa chỗ dùng.
const validationMessages = {
  badInput: "Giá trị nhập vào không hợp lệ.",
  patternMismatch: "Vui lòng nhập đúng định dạng yêu cầu.",
  requiredCheckbox: "Vui lòng tích vào ô này.",
  requiredFile: "Vui lòng chọn tệp.",
  requiredSelect: "Vui lòng chọn một mục.",
  requiredText: "Vui lòng điền thông tin này.",
  stepMismatch: "Vui lòng nhập giá trị hợp lệ.",
  tooLong: (max: number) => `Vui lòng nhập tối đa ${max} ký tự.`,
  tooShort: (min: number) => `Vui lòng nhập tối thiểu ${min} ký tự.`,
  typeEmail: "Vui lòng nhập địa chỉ email hợp lệ.",
  typeUrl: "Vui lòng nhập đường dẫn (URL) hợp lệ.",
  rangeOverflow: (max: string) => `Giá trị phải nhỏ hơn hoặc bằng ${max}.`,
  rangeUnderflow: (min: string) => `Giá trị phải lớn hơn hoặc bằng ${min}.`,
};

function messageFor(field: Field): string {
  const { validity } = field;
  const type = field instanceof HTMLInputElement ? field.type : undefined;

  if (validity.valueMissing) {
    if (type === "checkbox" || type === "radio") return validationMessages.requiredCheckbox;
    if (type === "file") return validationMessages.requiredFile;
    if (field instanceof HTMLSelectElement) return validationMessages.requiredSelect;
    return validationMessages.requiredText;
  }
  if (validity.typeMismatch) return type === "url" ? validationMessages.typeUrl : validationMessages.typeEmail;
  if (validity.patternMismatch) return field.title || validationMessages.patternMismatch;
  if (validity.tooShort) return validationMessages.tooShort(Number((field as HTMLInputElement).minLength));
  if (validity.tooLong) return validationMessages.tooLong(Number((field as HTMLInputElement).maxLength));
  if (validity.rangeUnderflow) return validationMessages.rangeUnderflow((field as HTMLInputElement).min);
  if (validity.rangeOverflow) return validationMessages.rangeOverflow((field as HTMLInputElement).max);
  if (validity.stepMismatch) return validationMessages.stepMismatch;
  if (validity.badInput) return validationMessages.badInput;
  return "";
}

/** Việt hóa thông báo xác thực mặc định của trình duyệt cho mọi form trong CMS. */
export function VietnameseValidation() {
  useEffect(() => {
    function onInvalid(event: Event) {
      const field = event.target as Field;
      if (!field.setCustomValidity) return;
      // Giữ thông báo tùy chỉnh do code khác đặt (không phải do component này).
      if (field.dataset.vnValidation !== "1") field.setCustomValidity("");
      const message = messageFor(field);
      if (message) {
        field.setCustomValidity(message);
        field.dataset.vnValidation = "1";
      }
    }

    function onInput(event: Event) {
      const field = event.target as Field;
      if (field.dataset?.vnValidation === "1") {
        field.setCustomValidity("");
        delete field.dataset.vnValidation;
      }
    }

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    return () => {
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
    };
  }, []);

  return null;
}
