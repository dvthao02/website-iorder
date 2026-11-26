import { requireSuperAdmin } from "@/lib/admin-guard";
import { GmailCallback } from "@/components/admin/gmail-callback";
import { SettingsDetailPage } from "@/components/admin/settings-detail-page";

export const dynamic = "force-dynamic";

// Địa chỉ Google chuyển về sau khi cấp quyền Gmail (phải trùng địa chỉ đã đăng ký ở Google Cloud: gmailCallbackPath trong gmail.contract.ts).
export default async function GmailCallbackPage({ searchParams }: { searchParams: Promise<{ code?: string; state?: string; error?: string }> }) {
  await requireSuperAdmin();
  const { code, state, error } = await searchParams;
  return <SettingsDetailPage bare description="Đang nhận quyền từ Google để gửi thư báo liên hệ mới." title="Kết nối Gmail">
    <GmailCallback code={code} error={error} state={state} />
  </SettingsDetailPage>;
}
