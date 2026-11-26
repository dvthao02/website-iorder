import { equipmentAvailabilityLabels } from "../equipment/equipment-availability";
import type { LeadContext } from "../leads/leads.contract";

// Nội dung thư báo liên hệ mới. Hàm thuần: chỉ ghép chữ từ dữ liệu liên hệ, không gọi mạng. Thư là văn bản thuần (không HTML) nên
// nội dung khách nhập không thể chèn mã vào thư. Chỉ có thông tin nhân viên cần để gọi lại và đường dẫn mở liên hệ trong CMS.

export type LeadMailInput = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  businessModel?: string | null;
  branches?: string | null;
  need?: string | null;
  message?: string | null;
  context?: LeadContext | null;
  createdAt: Date;
};

const maxMessageLength = 1_500;
const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
const money = new Intl.NumberFormat("vi-VN");

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();
const truncate = (value: string, max: number) => value.length > max ? `${value.slice(0, max - 1)}…` : value;

export function composeLeadMail(lead: LeadMailInput, options: { cmsOrigin: string }) {
  const name = truncate(oneLine(lead.name), 60);
  const subject = `[iOrder] Liên hệ mới: ${name} · ${oneLine(lead.phone)}${lead.context ? ` · hỏi mua ${truncate(oneLine(lead.context.name), 50)}` : ""}`;
  const rows: Array<[string, string | null | undefined]> = [
    ["Họ tên", oneLine(lead.name)],
    ["Số điện thoại", oneLine(lead.phone)],
    ["Email", lead.email],
    ["Mô hình kinh doanh", lead.businessModel],
    ["Số chi nhánh", lead.branches],
    ["Nhu cầu", lead.need],
  ];
  const lines = ["Có liên hệ mới từ website.", ""];
  for (const [label, value] of rows) if (value?.trim()) lines.push(`${label}: ${oneLine(value)}`);
  if (lead.context) {
    const detail = [lead.context.modelCode ? `mã ${lead.context.modelCode}` : null, lead.context.priceVnd > 0 ? `${money.format(lead.context.priceVnd)} đ` : null, equipmentAvailabilityLabels[lead.context.availability]].filter(Boolean).join(" · ");
    lines.push(`Thiết bị quan tâm: ${oneLine(lead.context.name)}${detail ? ` (${detail})` : ""}`);
  }
  if (lead.message?.trim()) lines.push("", "Lời nhắn:", truncate(lead.message.trim(), maxMessageLength));
  lines.push("", `Thời gian: ${dateTime.format(lead.createdAt)} (giờ Việt Nam)`);
  const origin = options.cmsOrigin.replace(/\/+$/, "");
  if (origin) lines.push("", `Mở trong CMS: ${origin}/admin/leads?open=${encodeURIComponent(lead.id)}`);
  return { subject, text: lines.join("\n") };
}
