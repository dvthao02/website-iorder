"use client";

import { Plug, Send, Unplug } from "lucide-react";
import Link from "next/link";
import React, { useCallback, useEffect, useState, type FormEvent } from "react";

import { gmailStatusSchema, maxGmailCc, type GmailStatus } from "@iorder/shared/server/gmail/gmail.contract";

import { AdminApiError, adminErrorTextWithLogHint, requestAdminJson } from "../../lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";
import { AdminPasswordInput } from "./ui/admin-password-input";
import { AdminSwitch } from "./ui/admin-switch";

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

const errorByCode: Record<string, string> = {
  INVALID_PASSWORD: "Mật khẩu không đúng.",
  TOO_MANY_ATTEMPTS: "Nhập sai mật khẩu quá nhiều lần. Chờ vài phút rồi thử lại.",
  VERSION_CONFLICT: "Cài đặt vừa được người khác thay đổi. Tải lại trang để xem bản mới nhất.",
};
const failureText = (error: unknown) => error instanceof AdminApiError ? errorByCode[error.code ?? ""] ?? adminErrorTextWithLogHint(error) : "Không kết nối được máy chủ. Thử lại sau.";

type Prompt = "connect" | "disconnect" | null;
const emailPattern = /^[^\s@<>,;"()]+@[^\s@<>,;"()]+\.[^\s@<>,;"()]+$/;

async function loadStatus(): Promise<{ status: GmailStatus } | { error: string }> {
  try {
    const body = await requestAdminJson("/api/v1/admin/gmail", "GET", undefined, "Không đọc được trạng thái Gmail lúc này.", { cache: "no-store" }) as { status?: unknown } | null;
    const parsed = gmailStatusSchema.safeParse(body?.status);
    return parsed.success ? { status: parsed.data } : { error: "Không đọc được trạng thái Gmail lúc này." };
  } catch (error) {
    return { error: failureText(error) };
  }
}

/** Khung "Gmail báo liên hệ mới" (chỉ Super Admin): bấm Kết nối để Google cấp quyền gửi thư, rồi chọn các địa chỉ nhận bản sao (CC) khi có liên hệ mới. */
export function GmailConnectionCard() {
  const [state, setState] = useState<{ status: GmailStatus } | { error: string } | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [password, setPassword] = useState("");
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { show } = useAdminToast();

  const apply = useCallback((status: GmailStatus) => {
    setState({ status });
    setCc(status.settings.cc);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadStatus().then((result) => {
      if (cancelled) return;
      if ("status" in result) apply(result.status); else setState(result);
      // Quay về từ trang Google (xem gmail-callback.tsx): báo một lần rồi bỏ tham số khỏi địa chỉ.
      if ("status" in result && new URLSearchParams(window.location.search).get("gmail") === "connected") {
        show("Đã kết nối Gmail.", "success");
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    return () => { cancelled = true; };
  }, [apply, show]);

  if (!state) return <p aria-busy="true" className="admin-dashboard__empty">Đang tải trạng thái Gmail…</p>;
  if ("error" in state) return <AdminNotice tone="error">{state.error}</AdminNotice>;
  const { status } = state;
  const connection = status.connection;
  const redirectUri = `${window.location.origin}${status.callbackPath}`;
  const dirty = cc.join(",") !== status.settings.cc.join(",");

  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await task(); } catch (error) { show(failureText(error), "error"); } finally { setBusy(false); }
  }

  async function confirmPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) { show("Nhập mật khẩu của bạn để xác nhận.", "error"); return; }
    const action = prompt;
    await run(async () => {
      try {
        if (action === "connect") {
          const body = await requestAdminJson("/api/v1/admin/gmail", "POST", { action: "connect", password, redirectUri }, "Không bắt đầu được kết nối Gmail.", { cache: "no-store" }) as { authUrl?: unknown } | null;
          if (typeof body?.authUrl !== "string") throw new Error("Phản hồi không hợp lệ.");
          window.location.assign(body.authUrl);
          return;
        }
        const body = await requestAdminJson("/api/v1/admin/gmail", "POST", { action: "disconnect", password }, "Không ngắt được kết nối Gmail.", { cache: "no-store" }) as { status?: unknown } | null;
        const parsed = gmailStatusSchema.safeParse(body?.status);
        if (parsed.success) apply(parsed.data);
        show("Đã ngắt kết nối Gmail.", "success");
        setPrompt(null);
      } finally {
        setPassword("");
      }
    });
  }

  async function sendTest() {
    await run(async () => {
      const body = await requestAdminJson("/api/v1/admin/gmail", "POST", { action: "test" }, "Không gửi được thư thử.", { cache: "no-store" }) as { sent?: { to?: string; cc?: string[] }; status?: unknown } | null;
      const parsed = gmailStatusSchema.safeParse(body?.status);
      if (parsed.success) apply(parsed.data);
      show(`Đã gửi thư thử tới ${body?.sent?.to ?? "Gmail của bạn"}${body?.sent?.cc?.length ? ` (CC ${body.sent.cc.length} địa chỉ)` : ""}.`, "success");
    });
  }

  async function save() {
    await run(async () => {
      const body = await requestAdminJson("/api/v1/admin/gmail", "PUT", { enabled: status.settings.enabled, cc, expectedVersion: status.version }, "Không lưu được cài đặt Gmail.", { cache: "no-store" }) as { status?: unknown } | null;
      const parsed = gmailStatusSchema.safeParse(body?.status);
      if (parsed.success) apply(parsed.data);
      show("Đã lưu cài đặt Gmail.", "success");
    });
  }

  /** Công tắc có hiệu lực ngay: chỉ gửi trạng thái bật/tắt cùng danh sách CC đã lưu, không kéo theo địa chỉ CC đang nhập dở. */
  async function toggle(next: boolean) {
    await run(async () => {
      const body = await requestAdminJson("/api/v1/admin/gmail", "PUT", { enabled: next, cc: status.settings.cc, expectedVersion: status.version }, "Không đổi được trạng thái gửi thư báo.", { cache: "no-store" }) as { status?: unknown } | null;
      const parsed = gmailStatusSchema.safeParse(body?.status);
      if (parsed.success) setState({ status: parsed.data });
      show(next ? "Đã bật gửi thư báo liên hệ mới." : "Đã tắt gửi thư báo liên hệ mới.", "success");
    });
  }

  function addCc() {
    const address = ccInput.trim().toLowerCase();
    if (!emailPattern.test(address)) { show("Địa chỉ email không hợp lệ.", "error"); return; }
    if (cc.includes(address)) { show("Địa chỉ này đã có trong danh sách CC.", "error"); return; }
    if (cc.length >= maxGmailCc) { show(`Tối đa ${maxGmailCc} địa chỉ CC.`, "error"); return; }
    setCc([...cc, address]);
    setCcInput("");
  }

  // Công tắc chỉ "bật" khi thật sự gửi được: cài đặt bật mà chưa kết nối (hoặc cần kết nối lại) thì hiện tắt, kèm lời giải thích; kết nối xong sẽ gửi lại.
  const connected = connection?.status === "connected";
  const switchOn = status.settings.enabled && connected;
  const switchDescription = !connected ? (status.settings.enabled ? "Đang tạm dừng vì chưa kết nối Gmail. Kết nối xong sẽ tự gửi lại." : "Kết nối Gmail ở trên rồi bật công tắc này.")
      : status.settings.enabled ? `Mỗi liên hệ mới gửi từ ${connection?.email ?? ""} tới chính nó${status.settings.cc.length ? `, CC ${status.settings.cc.length} địa chỉ` : ""}.`
        : "Liên hệ mới vẫn lưu trong CMS nhưng không gửi thư.";

  const badge = !connection ? <AdminStatusBadge tone="neutral">Chưa kết nối</AdminStatusBadge>
    : connection.status === "connected" ? <AdminStatusBadge tone="success">Đã kết nối</AdminStatusBadge>
      : <AdminStatusBadge tone="warning">Cần kết nối lại</AdminStatusBadge>;

  return <AdminCard>
    <header>
      <div><h2>Gmail báo liên hệ mới</h2><p>Khi khách gửi liên hệ từ website, CMS gửi thư báo từ chính Gmail của bạn và CC thêm cho những địa chỉ bạn chọn. Chỉ xin quyền gửi thư, không đọc được hộp thư.</p></div>
      {badge}
    </header>
    <div className="admin-status-stack">

    {status.masterKey !== "ok" ? <AdminNotice tone="warning">CMS chưa có khóa chủ hợp lệ nên chưa đọc được Client ID và Client secret đã nhập (hoặc chưa lưu được giá trị mới). Vào <Link className="admin-link" href="/admin/integrations">Hệ thống → Kết nối &amp; khóa API</Link>, bấm <strong>Tạo khóa chủ</strong>, rồi nhập lại hai giá trị đó ở thẻ “Gmail (gửi thư báo liên hệ mới)”.</AdminNotice>
      : !status.clientConfigured ? <AdminNotice tone="warning">Chưa có Client ID và Client secret. Điền ở thẻ “Gmail (gửi thư báo liên hệ mới)” trong <Link className="admin-link" href="/admin/integrations">Hệ thống → Kết nối &amp; khóa API</Link> (bấm Cấu hình), rồi quay lại đây bấm Kết nối.</AdminNotice> : null}
    <details>
      <summary className="admin-link">Cách tạo Client ID ở Google Cloud (làm một lần)</summary>
      <ol className="admin-status-list admin-status-list--tight">
        <li><strong>1.</strong> Vào Google Cloud Console, tạo một project, bật <strong>Gmail API</strong> (APIs &amp; Services → Library).</li>
        <li><strong>2.</strong> OAuth consent screen: chọn <strong>External</strong>, thêm email của bạn vào Test users, rồi bấm <strong>Publish app</strong> để quyền không tự hết hạn sau 7 ngày. Google sẽ hiện cảnh báo “chưa xác minh” khi bạn cấp quyền; với Gmail của chính bạn thì chọn Tiếp tục.</li>
        <li><strong>3.</strong> Credentials → Create credentials → OAuth client ID → loại <strong>Web application</strong>. Ở Authorized redirect URIs thêm đúng địa chỉ: <code>{redirectUri}</code></li>
        <li><strong>4.</strong> Chép Client ID và Client secret vào thẻ “Gmail (gửi thư báo liên hệ mới)” ở <Link className="admin-link" href="/admin/integrations">Kết nối &amp; khóa API</Link>.</li>
      </ol>
    </details>

    {connection ? <ul className="admin-integration-rows">
      <li>
        <div>
          <strong>{connection.email}</strong>
          <small className="admin-status-note">Kết nối lúc {dateTime.format(new Date(connection.connectedAt))}{connection.lastSentAt ? ` · thư gần nhất ${dateTime.format(new Date(connection.lastSentAt))}` : " · chưa gửi thư nào"}</small>
          {connection.lastError ? <small className="admin-text-warning">Lần gửi lỗi gần nhất{connection.lastErrorAt ? ` (${dateTime.format(new Date(connection.lastErrorAt))})` : ""}: {connection.lastError}</small> : null}
        </div>
      </li>
    </ul> : null}

    {prompt ? <form className="admin-status-stack admin-integration-form" noValidate onSubmit={(event) => void confirmPrompt(event)}>
      <AdminFormField hint="Mật khẩu đăng nhập CMS của chính bạn, để xác nhận đây đúng là bạn." id="gmail-password" label="Mật khẩu của bạn">
        <AdminPasswordInput autoComplete="current-password" disabled={busy} id="gmail-password" onChange={(event) => setPassword(event.target.value)} value={password} />
      </AdminFormField>
      <div className="admin-status-tags">
        <AdminButton disabled={busy} type="submit" variant={prompt === "disconnect" ? "danger" : "primary"}>{busy ? "Đang xử lý…" : prompt === "connect" ? "Tiếp tục sang Google" : "Ngắt kết nối"}</AdminButton>
        <AdminButton disabled={busy} onClick={() => { setPrompt(null); setPassword(""); }} variant="secondary">Hủy</AdminButton>
      </div>
    </form> : <div className="admin-status-tags">
      <AdminButton disabled={busy || !status.clientConfigured} leadingIcon={<Plug aria-hidden="true" />} onClick={() => setPrompt("connect")} variant={connection?.status === "connected" ? "secondary" : "primary"}>{connection ? "Kết nối lại" : "Kết nối Gmail"}</AdminButton>
      {connection ? <AdminButton disabled={busy || connection.status !== "connected"} leadingIcon={<Send aria-hidden="true" />} onClick={() => void sendTest()} variant="secondary">Gửi thư thử</AdminButton> : null}
      {connection ? <AdminButton disabled={busy} leadingIcon={<Unplug aria-hidden="true" />} onClick={() => setPrompt("disconnect")} variant="danger">Ngắt kết nối</AdminButton> : null}
    </div>}

    <div className="admin-status-stack">
      <AdminSwitch checked={switchOn} description={switchDescription} disabled={busy || !connected} label="Gửi thư báo khi có liên hệ mới" onChange={(next) => void toggle(next)} />
    </div>

    {connection ? <div className="admin-status-stack">
      <AdminFormField hint={`Các địa chỉ này nhận bản sao (CC) của mỗi thư báo, tối đa ${maxGmailCc} địa chỉ. Thư gửi từ ${connection.email} tới chính nó nên hộp thư này luôn nhận.`} id="gmail-cc" label="Gửi bản sao (CC) tới">
        <div className="admin-status-tags">
          <input autoComplete="off" className="admin-input" disabled={busy} id="gmail-cc" inputMode="email" onChange={(event) => setCcInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCc(); } }} placeholder="ten@gmail.com" type="email" value={ccInput} />
          <AdminButton disabled={busy || !ccInput.trim()} onClick={addCc} variant="secondary">Thêm</AdminButton>
        </div>
      </AdminFormField>
      {cc.length ? <ul className="admin-integration-rows">{cc.map((address) => <li key={address}><div><strong>{address}</strong></div><AdminButton disabled={busy} onClick={() => setCc(cc.filter((item) => item !== address))} size="sm" variant="ghost">Gỡ</AdminButton></li>)}</ul> : <small className="admin-status-note">Chưa có địa chỉ CC nào.</small>}
      <div className="admin-status-tags"><AdminButton disabled={busy || !dirty} onClick={() => void save()} variant="primary">{busy ? "Đang lưu…" : "Lưu cài đặt"}</AdminButton>{dirty ? <small className="admin-status-note">Có thay đổi chưa lưu.</small> : null}</div>
    </div> : null}
    </div>
  </AdminCard>;
}
