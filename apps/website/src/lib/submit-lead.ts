export type LeadSubmitResult = { ok: boolean; message: string };

// Gửi liên hệ tới Backend (qua rewrite `/api/v1/leads`): dùng chung cho biểu mẫu trong trang và cửa sổ tư vấn.
export async function submitLead(payload: Record<string, FormDataEntryValue>): Promise<LeadSubmitResult> {
  try {
    const response = await fetch("/api/v1/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    if (response.ok) return { ok: true, message: body?.message ?? "Đã gửi thông tin. iOrder sẽ liên hệ lại sớm." };
    return { ok: false, message: body?.error?.message ?? "Không thể gửi liên hệ. Vui lòng thử lại sau." };
  } catch {
    return { ok: false, message: "Không kết nối được máy chủ. Vui lòng thử lại sau." };
  }
}
