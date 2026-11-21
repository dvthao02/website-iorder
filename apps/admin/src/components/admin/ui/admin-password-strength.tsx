import React from "react";

import type { PasswordAssessment } from "@/lib/password-strength";

/**
 * Thanh báo độ mạnh mật khẩu dưới ô nhập: 4 ô sáng theo mức, nhãn, số ký tự và một gợi ý ngắn.
 * Chưa nhập gì thì chỉ hiện lời nhắc yêu cầu. Chỉ nhãn mức là vùng thông báo (role="status"), nên trình đọc màn hình
 * chỉ đọc khi mức đổi chứ không đọc lại sau mỗi phím gõ. Phần tử gốc giữ `id` để ô nhập trỏ aria-describedby tới.
 */
export function AdminPasswordStrength({ assessment, id }: { assessment: PasswordAssessment; id?: string }) {
  const { level, segments, label, length, minLength, tip } = assessment;
  if (level === "empty") return <span className="admin-field__hint" id={id}>{tip}</span>;
  return <div className="admin-password-strength" data-level={level} id={id}>
    <div aria-hidden="true" className="admin-password-strength__bar">
      {[1, 2, 3, 4].map((step) => <span data-filled={step <= segments ? "" : undefined} key={step} />)}
    </div>
    <div className="admin-password-strength__row">
      <span>Độ mạnh: <strong role="status">{label}</strong></span>
      <span>{level === "too_short" ? `${length}/${minLength}` : length} ký tự</span>
    </div>
    <span className="admin-field__hint">{tip}</span>
  </div>;
}
