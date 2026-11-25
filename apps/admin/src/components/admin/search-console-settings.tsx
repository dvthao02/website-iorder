"use client";

import { Copy, RefreshCw } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";

import { AdminApiError, requestAdminJson } from "../../lib/admin-api";

import type { SearchConsoleDiagnosis } from "@iorder/shared/server/search-console/search-console.contract";

import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { useOptionalAdminPermissions } from "./ui/admin-permissions";

type Configured = Extract<SearchConsoleDiagnosis, { configured: true }>;

const permissionLabels: Record<string, string> = {
  siteOwner: "Chủ sở hữu",
  siteFullUser: "Đầy đủ",
  siteRestrictedUser: "Hạn chế (chỉ đọc)",
  siteUnverifiedUser: "Chưa xác minh",
};

const dateFormat = (value: string) => value.split("-").reverse().join("/");

type Status = { tone: "success" | "error" | "neutral"; label: string };

/** Trạng thái chung của kết nối, suy ra từ kết quả kiểm tra. */
export function searchConsoleStatus(diagnosis: SearchConsoleDiagnosis): Status {
  if (!diagnosis.configured) return { tone: "neutral", label: "Chưa nối" };
  if (diagnosis.problem) return { tone: "error", label: "Chưa được" };
  return { tone: "success", label: "Đã nối" };
}

// Trang này chỉ cần settings.view còn "Kết nối & khóa API" chỉ Super Admin vào được: người khác thấy tên mục (để biết nhờ ai) chứ không có liên kết dẫn tới trang chặn.
function IntegrationsLink({ canOpen }: { canOpen: boolean }) {
  return canOpen ? <Link className="admin-link" href="/admin/integrations">Hệ thống → Kết nối &amp; khóa API</Link> : <strong>Hệ thống → Kết nối &amp; khóa API</strong>;
}

function Sites({ sites }: { sites: Configured["sites"] }) {
  if (!sites.length) return <>Chưa thấy website nào</>;
  return <ul className="m-0 grid list-none gap-0.5 p-0">{sites.map((site) => <li key={site.siteUrl}>{site.siteUrl}{site.permissionLevel ? <small className="admin-text-muted whitespace-nowrap"> · {permissionLabels[site.permissionLevel] ?? site.permissionLevel}</small> : null}</li>)}</ul>;
}

/** Phần hiển thị thuần của màn (tách khỏi việc tải dữ liệu để kiểm thử được). */
export function SearchConsoleSettingsView({ diagnosis, checking = false, onCheck, onCopyEmail }: {
  diagnosis: SearchConsoleDiagnosis;
  checking?: boolean;
  onCheck?: () => void;
  onCopyEmail?: (email: string) => void;
}) {
  const { canOpenPath } = useOptionalAdminPermissions();
  const status = searchConsoleStatus(diagnosis);
  const configured = diagnosis.configured ? diagnosis : undefined;
  const email = configured?.email;
  const connected = Boolean(configured && !configured.problem);
  const emailBlock = email
    ? <span className="inline-flex flex-wrap items-center gap-2"><code>{email}</code>{onCopyEmail ? <AdminButton leadingIcon={<Copy aria-hidden="true" />} onClick={() => onCopyEmail(email)} size="sm" variant="secondary">Sao chép</AdminButton> : null}</span>
    : null;

  return <div className="grid gap-4">
    <AdminCard>
      <header>
        <div><h2>Kết nối Google Search Console</h2><p>Chỉ đọc: CMS không thay đổi gì trên Google.</p></div>
        <span className="inline-flex items-center gap-2"><AdminStatusBadge tone={status.tone}>{status.label}</AdminStatusBadge>
          <AdminButton disabled={checking} leadingIcon={<RefreshCw aria-hidden="true" />} onClick={onCheck} variant="secondary">{checking ? "Đang kiểm tra…" : "Kiểm tra kết nối"}</AdminButton></span>
      </header>

      {!configured ? <div className="mb-3"><AdminNotice tone="info">Chưa nối. Làm theo các bước bên dưới; xong bấm “Kiểm tra kết nối”. Khóa là bí mật: Super Admin nhập ở <IntegrationsLink canOpen={canOpenPath("/admin/integrations")} /> (mã hóa, cần nhập lại mật khẩu) hoặc người quản trị máy chủ đặt bằng biến môi trường.</AdminNotice></div> : null}
      {configured?.problem ? <div className="mb-3"><AdminNotice tone="error">{configured.problem}</AdminNotice></div> : null}
      {connected && configured ? <div className="mb-3"><AdminNotice tone="success">{configured.sampleQueries
        ? <>Đã nối được: Google trả về {configured.sampleQueries} cụm tìm kiếm mẫu{configured.period ? ` (${dateFormat(configured.period.startDate)} – ${dateFormat(configured.period.endDate)})` : ""}. Xem số liệu ở thẻ “Cơ hội trên Google” trong <Link className="admin-link" href="/admin">Bảng điều khiển</Link>.</>
        : <>Đã nối được, nhưng Google chưa có cụm tìm kiếm nào trong khoảng ngày này. Website mới thường cần vài ngày đến vài tuần.</>}</AdminNotice></div> : null}

      <dl className="admin-description-list">
        <div><dt>Tài khoản dịch vụ</dt><dd>{emailBlock ?? "—"}</dd></div>
        <div><dt>Website khai trong CMS</dt><dd>{configured ? (configured.websiteUrl ?? "Chưa đặt") : "—"}<span className="block"><Link className="admin-link" href="/admin/seo">Sửa ở Tên miền &amp; SEO</Link></span></dd></div>
        <div><dt>Thuộc tính đang dùng</dt><dd>{configured?.property ?? "—"}{configured?.propertyFromSetting ? <small className="admin-text-muted block">Đặt cố định bằng SEARCH_CONSOLE_PROPERTY</small> : null}</dd></div>
        <div><dt>Khóa được đặt bằng</dt><dd>{configured ? (configured.source === "file" ? "Tệp trên máy chủ (GOOGLE_SERVICE_ACCOUNT_FILE)" : configured.source === "cms" ? "CMS (đã mã hóa, nhập ở Kết nối & khóa API)" : "Biến GOOGLE_SERVICE_ACCOUNT_JSON") : "Chưa đặt"}</dd></div>
        <div><dt>Website tài khoản này thấy</dt><dd>{configured ? <Sites sites={configured.sites} /> : "—"}</dd></div>
      </dl>
    </AdminCard>

    <AdminCard>
      <header><div><h2>Cách nối (làm một lần)</h2><p>Bước 1–3 làm trên Google; bước 4 do người quản trị máy chủ làm.</p></div></header>
      <ol className="m-0 grid gap-2 pl-5 text-[13px]">
        <li><strong>Thêm website vào Search Console.</strong> Vào Google Search Console, thêm website, chọn loại “Tên miền” và xác minh bằng bản ghi TXT trong DNS (đừng xóa bản ghi sau đó). Gửi sơ đồ <code>sitemap.xml</code>.</li>
        <li><strong>Tạo tài khoản dịch vụ.</strong> Vào Google Cloud Console, tạo project, bật “Google Search Console API”, tạo Service Account rồi tạo khóa dạng JSON và tải về.</li>
        <li><strong>Cho tài khoản đó xem dữ liệu.</strong> Trong Search Console: Cài đặt → Người dùng và quyền → Thêm người dùng. Dán email của tài khoản dịch vụ {emailBlock ?? <>(dạng <code>…@….iam.gserviceaccount.com</code>)</>}, chọn quyền <strong>Hạn chế</strong>. Nếu sau này báo lỗi 403 mới nâng lên Đầy đủ.</li>
        <li><strong>Đặt khóa.</strong> Cách dễ nhất: Super Admin vào <IntegrationsLink canOpen={canOpenPath("/admin/integrations")} />, chọn tệp JSON và nhập lại mật khẩu của mình (cần máy chủ đã đặt <code>SECRETS_MASTER_KEY</code>). Hoặc người quản trị máy chủ đặt <code>GOOGLE_SERVICE_ACCOUNT_FILE</code> (đường dẫn tới tệp JSON, để ngoài thư mục dự án) hay <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (nội dung tệp trên một dòng, dùng cho Docker) rồi khởi động lại Backend; biến môi trường luôn thắng. Khóa là bí mật: không gửi qua chat hay đưa lên git.</li>
        <li><strong>Kiểm tra.</strong> Bấm “Kiểm tra kết nối” ở trên. Thiếu gì màn này sẽ nói cách sửa. Số liệu thật thường có sau 2–3 ngày.</li>
      </ol>
    </AdminCard>
  </div>;
}

type CheckResult = { ok: true; diagnosis: SearchConsoleDiagnosis } | { ok: false; message: string };

/** Hỏi backend kết quả kiểm tra kết nối (backend gọi Google, không dùng bộ nhớ đệm). Hàm thuần: không đổi state. */
async function requestDiagnosis(): Promise<CheckResult> {
  try {
    const body = await requestAdminJson("/api/v1/admin/search-console?diagnose=1", "GET", undefined, "Không kiểm tra được kết nối lúc này. Thử lại sau.", { cache: "no-store" }) as { diagnosis?: SearchConsoleDiagnosis } | null;
    if (!body?.diagnosis) return { ok: false, message: "Không kiểm tra được kết nối lúc này. Thử lại sau." };
    return { ok: true, diagnosis: body.diagnosis };
  } catch (error) {
    return { ok: false, message: error instanceof AdminApiError ? error.message : "Không kết nối được máy chủ để kiểm tra." };
  }
}

/** Màn "Google Search Console" trong Cài đặt: kiểm tra kết nối lúc mở màn và mỗi lần bấm nút. */
export function SearchConsoleSettings() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; diagnosis: SearchConsoleDiagnosis }>({ status: "loading" });
  const [checking, setChecking] = useState(false);
  const { show } = useAdminToast();

  useEffect(() => {
    let cancelled = false;
    void requestDiagnosis().then((result) => {
      if (!cancelled) setState(result.ok ? { status: "ready", diagnosis: result.diagnosis } : { status: "error", message: result.message });
    });
    return () => { cancelled = true; };
  }, []);

  const check = useCallback(async () => {
    setChecking(true);
    const result = await requestDiagnosis();
    setState(result.ok ? { status: "ready", diagnosis: result.diagnosis } : { status: "error", message: result.message });
    if (!result.ok) show(result.message, "error");
    else if (!result.diagnosis.configured) show("Chưa nối Google Search Console.", "info");
    else if (result.diagnosis.problem) show("Chưa nối được. Xem lý do ở mục Kết nối.", "error");
    else show("Đã nối được Google Search Console.", "success");
    setChecking(false);
  }, [show]);

  const copyEmail = useCallback(async (email: string) => {
    try { await navigator.clipboard.writeText(email); show("Đã sao chép email tài khoản dịch vụ.", "success"); } catch { show("Không sao chép được. Hãy bôi đen email rồi sao chép thủ công.", "error"); }
  }, [show]);

  if (state.status === "loading") return <p aria-busy="true" className="admin-dashboard__empty">Đang kiểm tra kết nối…</p>;
  if (state.status === "error") return <div className="grid gap-3"><AdminNotice tone="error">{state.message}</AdminNotice><div><AdminButton disabled={checking} onClick={() => void check()} variant="secondary">Thử lại</AdminButton></div></div>;
  return <SearchConsoleSettingsView checking={checking} diagnosis={state.diagnosis} onCheck={() => void check()} onCopyEmail={(email) => void copyEmail(email)} />;
}
