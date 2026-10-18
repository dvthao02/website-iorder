import type { LeadStatus } from "./leads.contract";

export type LeadCsvRow = {
  name: string; phone: string; email: string | null; businessModel: string | null; branches: string | null;
  need: string | null; message: string | null; status: LeadStatus; createdAt: Date; handledAt: Date | null;
};

const statusLabels: Record<LeadStatus, string> = { new: "Mới", contacted: "Đã liên hệ", closed: "Đã xử lý" };
const columns = ["Thời điểm gửi", "Họ tên", "Điện thoại", "Email", "Mô hình kinh doanh", "Số chi nhánh", "Nhu cầu", "Lời nhắn", "Trạng thái", "Xử lý lúc"];
// "2026-10-17 10:00" theo giờ Việt Nam: Excel nhận là ngày giờ và sắp xếp đúng.
const dateParts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Ho_Chi_Minh" });
const dateTime = { format(date: Date) { const part = Object.fromEntries(dateParts.formatToParts(date).map(({ type, value }) => [type, value])); return `${part.year}-${part.month}-${part.day} ${part.hour}:${part.minute}`; } };

// Ô bắt đầu bằng = + - @ (kể cả sau khoảng trắng/tab) bị Excel hiểu là công thức: thêm dấu ' để chỉ hiển thị như chữ.
function cell(value: string | null) {
  if (!value) return "";
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV cho Excel: có BOM để mở đúng tiếng Việt, xuống dòng CRLF, giờ theo Việt Nam. */
export function leadsToCsv(rows: readonly LeadCsvRow[]) {
  const lines = [columns.join(","), ...rows.map((row) => [
    dateTime.format(row.createdAt), row.name, row.phone, row.email, row.businessModel, row.branches,
    row.need, row.message, statusLabels[row.status], row.handledAt ? dateTime.format(row.handledAt) : null,
  ].map(cell).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}
