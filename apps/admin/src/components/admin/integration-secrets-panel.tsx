"use client";

import { KeyRound } from "lucide-react";
import React, { useCallback, useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";

import { integrationTools, secretMetas, type IntegrationToolId, type SecretKey, type SecretStatus, type SecretsOverview } from "@iorder/shared/server/secrets/secrets.contract";

import { AdminApiError, adminErrorTextWithLogHint, requestAdminJson } from "../../lib/admin-api";
import { AdminButton } from "./ui/admin-button";
import { AdminCard } from "./ui/admin-card";
import { AdminNotice, AdminStatusBadge, useAdminToast } from "./ui/admin-feedback";
import { AdminFormField } from "./ui/admin-form-field";
import { AdminPasswordInput } from "./ui/admin-password-input";
import { AdminSidePanel } from "./ui/admin-side-panel";

const dateTime = new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });

type IntegrationTool = (typeof integrationTools)[number];

const stateText: Record<SecretStatus["state"], { tone: "success" | "warning" | "neutral"; label: string }> = {
  cms: { tone: "success", label: "Đã đặt ở CMS" },
  env: { tone: "warning", label: "Đang dùng biến môi trường" },
  none: { tone: "neutral", label: "Chưa đặt" },
};

const fieldsOf = (tool: IntegrationTool, overview: SecretsOverview) => tool.keys.map((key) => overview.secrets.find((secret) => secret.key === key)).filter((secret): secret is SecretStatus => Boolean(secret));

/** Tình trạng một công cụ: chỉ đếm biến bắt buộc (biến không bắt buộc thiếu thì công cụ vẫn là đã thiết lập). */
function toolState(tool: IntegrationTool, fields: SecretStatus[]): { tone: "success" | "warning" | "neutral"; label: string } {
  const optional: readonly string[] = "optionalKeys" in tool ? tool.optionalKeys : [];
  const required = fields.filter((secret) => !optional.includes(secret.key));
  const set = required.filter((secret) => secret.state !== "none").length;
  if (set === required.length) return { tone: "success", label: "Đã thiết lập" };
  return set > 0 ? { tone: "warning", label: "Thiếu thông tin" } : { tone: "neutral", label: "Chưa thiết lập" };
}

/**
 * Phần hiển thị thuần (tách khỏi việc tải/gửi dữ liệu để kiểm thử được). Mỗi công cụ là một thẻ: tên, một dòng mô tả, một tình trạng, một nút Cấu hình
 * (mở MỘT panel trượt chứa mọi biến của công cụ). Giải thích bảo mật, nguồn khóa chủ và từng biến gập sẵn; chỉ cảnh báo chặn việc lưu mới hiện thẳng.
 */
export function IntegrationSecretsView({ overview, editingTool, onEditTool, onCloseEdit, renderForm, creatingMasterKey = false, onCreateMasterKey, onCloseMasterKey, masterKeyForm }: {
  overview: SecretsOverview;
  /** Công cụ đang mở trong panel trượt. */
  editingTool?: IntegrationToolId | null;
  onEditTool?: (tool: IntegrationToolId) => void;
  /** Đóng panel trượt đang mở (Esc, bấm nền hoặc nút đóng). */
  onCloseEdit?: () => void;
  renderForm?: (tool: IntegrationTool, secrets: SecretStatus[]) => ReactNode;
  /** Đang mở panel "Tạo khóa chủ" (nhập mật khẩu). */
  creatingMasterKey?: boolean;
  onCreateMasterKey?: () => void;
  onCloseMasterKey?: () => void;
  masterKeyForm?: ReactNode;
}) {
  const locked = overview.masterKey !== "ok";
  const openTool = editingTool ? integrationTools.find((tool) => tool.id === editingTool) : undefined;
  return <div className="admin-status-stack admin-status-stack--wide">
    <AdminCard>
      <p className="admin-integration-intro">Điền thông tin để CMS nối với các công cụ bên dưới. Thông tin được mã hóa, và mỗi lần lưu cần nhập lại mật khẩu của bạn.</p>
      {overview.masterKey === "missing" && overview.canCreateMasterKey ? <>
        <AdminNotice tone="warning">Chưa có khóa chủ nên chưa lưu được khóa ở CMS. Bấm “Tạo khóa chủ”: CMS tự tạo một khóa ngẫu nhiên và cất trong tệp riêng trên máy chủ{overview.keyFilePath ? <> (<code>{overview.keyFilePath}</code>)</> : null}, không nằm trong database hay bản sao lưu database. Khóa chủ không xem lại được, dùng được ngay, không cần khởi động lại. Hoặc người quản trị máy chủ đặt biến <code>SECRETS_MASTER_KEY</code>.</AdminNotice>
        <div><AdminButton leadingIcon={<KeyRound aria-hidden="true" />} onClick={onCreateMasterKey} variant="primary">Tạo khóa chủ</AdminButton></div>
      </> : null}
      {overview.masterKey === "missing" && !overview.canCreateMasterKey ? <AdminNotice tone="warning">Chưa đặt khóa chủ nên chưa lưu được khóa ở CMS. Người quản trị máy chủ tạo khóa bằng lệnh <code>openssl rand -base64 32</code>, đặt vào biến <code>SECRETS_MASTER_KEY</code> rồi khởi động lại Backend. Cất khóa chủ ở nơi riêng (ví dụ trình quản lý mật khẩu): mất khóa này thì phải nhập lại toàn bộ khóa API.</AdminNotice> : null}
      {overview.masterKey === "invalid" ? <AdminNotice tone="error">Khóa chủ {overview.masterKeySource === "file" ? <>trong tệp trên máy chủ{overview.keyFilePath ? <> (<code>{overview.keyFilePath}</code>)</> : null} không đọc được hoặc</> : <><code>SECRETS_MASTER_KEY</code></>} sai định dạng: cần base64 của đúng 32 byte (tạo bằng <code>openssl rand -base64 32</code>). Sửa rồi khởi động lại Backend. CMS không tự tạo đè lên khóa đã có.</AdminNotice> : null}
      <details className="admin-integration-details">
        <summary className="admin-link">Bảo mật và chi tiết kỹ thuật</summary>
        <ul className="admin-status-list admin-status-list--tight">
          <li>Khóa bí mật chỉ ghi: lưu xong không xem lại được, muốn đổi thì nhập khóa mới. Địa chỉ và mã không bí mật thì hiện lại được.</li>
          <li>Mỗi lần lưu hoặc xóa đều phải <strong>nhập lại mật khẩu của chính bạn</strong>; nhập sai nhiều lần sẽ bị chặn tạm.</li>
          <li>Khóa được <strong>mã hóa</strong> trước khi lưu vào cơ sở dữ liệu; khóa giải mã nằm ở máy chủ, không nằm trong database hay bản sao lưu.</li>
          <li>Nếu máy chủ đã đặt biến môi trường tương ứng thì biến <strong>thắng</strong>: giá trị ở đây chưa có hiệu lực cho tới khi gỡ biến đó.</li>
          <li>Mọi thay đổi được ghi vào Nhật ký hoạt động (chỉ ghi ai đổi khóa nào, không ghi giá trị).</li>
        </ul>
        {overview.masterKey === "ok" && overview.masterKeySource === "file" ? <AdminNotice tone="info">Khóa chủ đang cất trong tệp trên máy chủ{overview.keyFilePath ? <> (<code>{overview.keyFilePath}</code>)</> : null}. Sao lưu riêng tệp này (nó không nằm trong sao lưu database); mất tệp thì phải nhập lại toàn bộ khóa API.</AdminNotice> : null}
        {overview.masterKey === "ok" && overview.masterKeySource === "env" ? <AdminNotice tone="info">Khóa chủ lấy từ biến môi trường <code>SECRETS_MASTER_KEY</code> của máy chủ.</AdminNotice> : null}
      </details>
    </AdminCard>

    {integrationTools.map((tool) => {
      const fields = fieldsOf(tool, overview);
      const overridden = fields.filter((secret) => secret.envOverrides);
      const overriddenNames = [...new Set(overridden.flatMap((secret) => secretMetas[secret.key].envNames))];
      const state = toolState(tool, fields);
      return <AdminCard key={tool.id}>
        <header>
          <div><h2>{tool.label}</h2><p>{tool.description}</p></div>
          <AdminStatusBadge tone={state.tone}>{state.label}</AdminStatusBadge>
        </header>
        {overridden.length ? <small className="admin-status-note">Máy chủ đang dùng cấu hình riêng nên giá trị nhập ở đây chưa có tác dụng.</small> : null}
        <div className="admin-status-tags">
          <AdminButton disabled={locked} leadingIcon={<KeyRound aria-hidden="true" />} onClick={() => onEditTool?.(tool.id)} variant="primary">Cấu hình</AdminButton>
          {tool.id === "gmail" ? <AdminButton href="/admin/integrations/gmail" variant="secondary">Kết nối Gmail</AdminButton> : null}
        </div>
        {locked ? <small className="admin-status-note">Chưa lưu được: máy chủ chưa có khóa chủ hợp lệ (xem khung cảnh báo ở đầu trang).</small> : null}
        <details className="admin-integration-details">
          <summary className="admin-link">Xem từng mục ({fields.length})</summary>
          {overridden.length ? <AdminNotice tone="warning">Máy chủ đã đặt biến {overriddenNames.map((name, index) => <React.Fragment key={name}>{index ? ", " : ""}<code>{name}</code></React.Fragment>)} nên các giá trị tương ứng đang được dùng thay cho giá trị ở CMS (giá trị ở CMS được giữ nhưng chưa có hiệu lực). Muốn quản lý ở CMS, nhờ người quản trị máy chủ gỡ biến đó rồi khởi động lại Backend.</AdminNotice> : null}
          <ul className="admin-integration-rows">
            {fields.map((secret) => {
              const badge = secret.unreadable ? { tone: "warning" as const, label: "Cần nhập lại" } : stateText[secret.state];
              return <li key={secret.key}>
                <div>
                  <strong>{secret.label}</strong>
                  <span className="admin-integration-rows__value">{secret.hint ?? "—"}</span>
                  {secret.unreadable ? <small className="admin-status-note admin-text-warning">Giá trị đã lưu không đọc được (khóa chủ đã mất hoặc bị đổi). Bấm Cấu hình để nhập lại.</small> : null}
                  {secret.updatedAt ? <small className="admin-status-note">Cập nhật {dateTime.format(new Date(secret.updatedAt))}{secret.updatedByName ? ` bởi ${secret.updatedByName}` : ""}</small> : null}
                </div>
                <AdminStatusBadge tone={badge.tone}>{badge.label}</AdminStatusBadge>
              </li>;
            })}
          </ul>
        </details>
      </AdminCard>;
    })}

    <AdminSidePanel className="admin-integration-panel" closeLabel="Đóng" isOpen={Boolean(openTool)} label={openTool ? `Cấu hình ${openTool.label}` : "Cấu hình kết nối"} onClose={() => onCloseEdit?.()}>
      {openTool ? <div className="admin-status-stack admin-integration-panel__body">
        <header><h2>{openTool.label}</h2><p>{openTool.description}</p></header>
        {renderForm?.(openTool, fieldsOf(openTool, overview))}
      </div> : null}
    </AdminSidePanel>
    <AdminSidePanel className="admin-integration-panel" closeLabel="Đóng" isOpen={creatingMasterKey} label="Tạo khóa chủ" onClose={() => onCloseMasterKey?.()}>
      <div className="admin-status-stack admin-integration-panel__body">
        <header><h2>Tạo khóa chủ</h2><p>CMS tự tạo một khóa ngẫu nhiên và cất trong tệp riêng trên máy chủ{overview.keyFilePath ? <> (<code>{overview.keyFilePath}</code>)</> : null}. Khóa không xem lại được; chỉ cần nhập lại mật khẩu của bạn để xác nhận.</p></header>
        {masterKeyForm}
      </div>
    </AdminSidePanel>
  </div>;
}

const errorByCode: Record<string, string> = {
  INVALID_PASSWORD: "Mật khẩu không đúng.",
  TOO_MANY_ATTEMPTS: "Nhập sai mật khẩu quá nhiều lần. Chờ vài phút rồi thử lại.",
  VERSION_CONFLICT: "Giá trị vừa được người khác thay đổi. Tải lại trang để xem bản mới nhất.",
  MASTER_KEY_EXISTS: "Máy chủ đã có khóa chủ. Tải lại trang.",
};

type FormError = { field: SecretKey | "password" | "form"; message: string };
type ApiError = { code?: string; message?: string; key?: string };
const isSecretKey = (value: unknown): value is SecretKey => typeof value === "string" && value in secretMetas;

/** Giá trị ban đầu của ô nhập: biến không bí mật hiện lại giá trị đang lưu; khóa bí mật luôn để trống (để trống = giữ nguyên). */
const initialValue = (secret: SecretStatus) => secret.exposeValue && secret.storedInCms ? secret.hint ?? "" : "";

/**
 * Biểu mẫu của MỘT công cụ: mọi biến của công cụ trong một panel, một lần nhập mật khẩu, một nút Lưu. Chỉ gửi biến đã sửa.
 * Giá trị và mật khẩu chỉ nằm trong state của biểu mẫu và bị xóa ngay khi lưu xong hoặc đóng panel.
 */
export function ToolSecretsForm({ tool, secrets, onSaved, onCancel }: { tool: IntegrationTool; secrets: SecretStatus[]; onSaved: (statuses: SecretStatus[], options: { close: boolean }) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(secrets.map((secret) => [secret.key, initialValue(secret)])));
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  // Chỉ để tô viền ô sai; câu báo lỗi hiện ở thông báo nổi (toast).
  const [invalid, setInvalid] = useState<FormError["field"] | null>(null);
  const { show } = useAdminToast();
  const idOf = (key: string) => `secret-${tool.id}-${key}`;
  const reject = useCallback((field: FormError["field"], message: string) => { setInvalid(field); show(message, "error"); }, [show]);

  const setValue = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function chooseFile(secret: SecretStatus, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setInvalid(null);
    if (!file) { setValue(secret.key, ""); setFileNames((current) => ({ ...current, [secret.key]: "" })); return; }
    if (file.size > 20_000) { setValue(secret.key, ""); setFileNames((current) => ({ ...current, [secret.key]: "" })); reject(secret.key, "Tệp quá lớn: tệp khóa JSON của Google chỉ vài KB. Chọn đúng tệp tải từ Google Cloud."); return; }
    setValue(secret.key, await file.text());
    setFileNames((current) => ({ ...current, [secret.key]: file.name }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const toSet = secrets.filter((secret) => !removed.has(secret.key) && values[secret.key]?.trim() && values[secret.key] !== initialValue(secret));
    const toClear = secrets.filter((secret) => removed.has(secret.key) && secret.storedInCms);
    if (!toSet.length && !toClear.length) { reject("form", "Chưa có thay đổi nào để lưu."); return; }
    if (!password) { reject("password", "Nhập mật khẩu của bạn để xác nhận."); return; }
    setBusy(true);
    setInvalid(null);
    const saved: SecretStatus[] = [];
    const fail = (apiError: ApiError | null | undefined) => {
      const code = apiError?.code ?? "";
      const field: FormError["field"] = code === "INVALID_SECRET" && isSecretKey(apiError?.key) ? apiError.key : code === "INVALID_PASSWORD" || code === "TOO_MANY_ATTEMPTS" ? "password" : "form";
      setPassword("");
      reject(field, errorByCode[code] ?? apiError?.message ?? "Không lưu được lúc này. Thử lại sau.");
      if (saved.length) onSaved(saved, { close: false });
    };
    try {
      if (toSet.length) {
        const body = await requestAdminJson("/api/v1/admin/secrets", "PUT", { items: toSet.map((secret) => ({ key: secret.key, value: values[secret.key], expectedVersion: secret.version })), password }, "Không lưu được lúc này. Thử lại sau.", { cache: "no-store" }) as { statuses?: SecretStatus[] } | null;
        if (!body?.statuses) { fail(undefined); return; }
        saved.push(...body.statuses);
      }
      for (const secret of toClear) {
        const body = await requestAdminJson("/api/v1/admin/secrets", "DELETE", { key: secret.key, password }, "Không lưu được lúc này. Thử lại sau.", { cache: "no-store" }) as { status?: SecretStatus } | null;
        if (!body?.status) { fail(undefined); return; }
        saved.push(body.status);
      }
      setValues({}); setPassword(""); setFileNames({});
      show(toClear.length && !toSet.length ? "Đã xóa khỏi CMS." : "Đã lưu (khóa bí mật đã mã hóa).", "success");
      onSaved(saved, { close: true });
    } catch (requestError) {
      // Phản hồi lỗi của máy chủ (kèm mã và, với INVALID_SECRET, tên khóa sai); còn lại là mất kết nối.
      if (requestError instanceof AdminApiError) { fail({ code: requestError.code, message: adminErrorTextWithLogHint(requestError), key: typeof requestError.details?.key === "string" ? requestError.details.key : undefined }); return; }
      reject("form", "Không kết nối được máy chủ. Thử lại sau.");
      if (saved.length) onSaved(saved, { close: false });
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-status-stack admin-integration-form" noValidate onSubmit={(event) => void submit(event)}>
    {secrets.map((secret) => {
      const id = idOf(secret.key);
      const isFile = secret.input === "json_file";
      const markedForRemoval = removed.has(secret.key);
      const note = secret.exposeValue ? secret.description : `${secret.description}${secret.storedInCms && !secret.unreadable ? " Đã có giá trị (không xem lại được): để trống nếu giữ nguyên, nhập mới để thay." : ""}`;
      return <AdminFormField hint={note} id={id} key={secret.key} label={secret.label}>
        {isFile
          ? <><input accept="application/json,.json" aria-invalid={invalid === secret.key || undefined} disabled={busy || markedForRemoval} id={id} onChange={(event) => void chooseFile(secret, event)} type="file" />{fileNames[secret.key] ? <small className="admin-status-note">Đã chọn: {fileNames[secret.key]}. Nội dung không hiển thị trên màn hình.</small> : null}</>
          : secret.exposeValue
            ? <input aria-invalid={invalid === secret.key || undefined} autoComplete="off" className="admin-input" disabled={busy || markedForRemoval} id={id} onChange={(event) => setValue(secret.key, event.target.value)} placeholder={secret.placeholder} spellCheck={false} type="text" value={values[secret.key] ?? ""} />
            : <AdminPasswordInput aria-invalid={invalid === secret.key || undefined} autoComplete="off" disabled={busy || markedForRemoval} id={id} onChange={(event) => setValue(secret.key, event.target.value)} placeholder={secret.storedInCms && !secret.unreadable ? "Để trống = giữ nguyên" : undefined} spellCheck={false} value={values[secret.key] ?? ""} />}
        {secret.storedInCms ? <label className="admin-integration-remove"><input checked={markedForRemoval} disabled={busy} onChange={(event) => setRemoved((current) => { const next = new Set(current); if (event.target.checked) next.add(secret.key); else next.delete(secret.key); return next; })} type="checkbox" /> Xóa khỏi CMS</label> : null}
      </AdminFormField>;
    })}
    {removed.size ? <AdminNotice tone="warning">Các biến đánh dấu “Xóa khỏi CMS” sẽ bị xóa khi lưu: tính năng dùng chúng sẽ ngừng hoạt động (trừ khi máy chủ có biến môi trường tương ứng).</AdminNotice> : null}
    <AdminFormField hint="Mật khẩu đăng nhập CMS của chính bạn, để xác nhận đây đúng là bạn. Không phải mật khẩu của khóa." id={idOf("password")} label="Mật khẩu của bạn (để xác nhận)">
      <AdminPasswordInput aria-invalid={invalid === "password" || undefined} autoComplete="current-password" disabled={busy} id={idOf("password")} onChange={(event) => setPassword(event.target.value)} value={password} />
    </AdminFormField>
    <div className="admin-status-tags admin-integration-actions">
      <AdminButton disabled={busy} type="submit" variant="primary">{busy ? "Đang lưu…" : "Lưu"}</AdminButton>
      <AdminButton disabled={busy} onClick={onCancel} variant="secondary">Hủy</AdminButton>
    </div>
  </form>;
}

/** Biểu mẫu "Tạo khóa chủ": chỉ cần nhập lại mật khẩu của bạn. Khóa chủ do máy chủ tự sinh, không bao giờ trả về trình duyệt. */
export function MasterKeyForm({ onDone, onCancel }: { onDone: (overview: SecretsOverview) => void; onCancel: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const { show } = useAdminToast();
  const reject = (message: string) => { setInvalid(true); show(message, "error"); };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!password) { reject("Nhập mật khẩu của bạn để xác nhận."); return; }
    setBusy(true);
    setInvalid(false);
    try {
      const body = await requestAdminJson("/api/v1/admin/secrets", "POST", { action: "create-master-key", password }, "Không tạo được khóa chủ lúc này. Thử lại sau.", { cache: "no-store" }) as { overview?: SecretsOverview } | null;
      if (!body?.overview) {
        setPassword("");
        reject("Không tạo được khóa chủ lúc này. Thử lại sau.");
        return;
      }
      setPassword("");
      show("Đã tạo khóa chủ. Giờ có thể đặt khóa API.", "success");
      onDone(body.overview);
    } catch (requestError) {
      if (requestError instanceof AdminApiError) {
        setPassword("");
        reject(errorByCode[requestError.code ?? ""] ?? adminErrorTextWithLogHint(requestError));
        return;
      }
      reject("Không kết nối được máy chủ. Thử lại sau.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-status-stack admin-integration-form" noValidate onSubmit={(event) => void submit(event)}>
    <AdminFormField hint="Mật khẩu đăng nhập CMS của chính bạn, để xác nhận đây đúng là bạn." id="master-key-password" label="Mật khẩu của bạn (để xác nhận)">
      <AdminPasswordInput aria-invalid={invalid || undefined} autoComplete="current-password" disabled={busy} id="master-key-password" onChange={(event) => setPassword(event.target.value)} value={password} />
    </AdminFormField>
    <div className="admin-status-tags admin-integration-actions">
      <AdminButton disabled={busy} type="submit" variant="primary">{busy ? "Đang tạo…" : "Tạo khóa chủ"}</AdminButton>
      <AdminButton disabled={busy} onClick={onCancel} variant="secondary">Hủy</AdminButton>
    </div>
  </form>;
}

type Loaded = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; overview: SecretsOverview };

async function requestOverview(): Promise<Loaded> {
  try {
    const body = await requestAdminJson("/api/v1/admin/secrets", "GET", undefined, "Không đọc được danh sách khóa lúc này. Thử lại sau.", { cache: "no-store" }) as { overview?: SecretsOverview } | null;
    if (!body?.overview) return { status: "error", message: "Không đọc được danh sách khóa lúc này. Thử lại sau." };
    return { status: "ready", overview: body.overview };
  } catch (requestError) {
    return { status: "error", message: requestError instanceof AdminApiError ? requestError.message : "Không kết nối được máy chủ." };
  }
}

/** Màn "Kết nối & khóa API" (chỉ Super Admin). */
export function IntegrationSecretsPanel() {
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [editingTool, setEditingTool] = useState<IntegrationToolId | null>(null);
  const [creatingMasterKey, setCreatingMasterKey] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void requestOverview().then((result) => { if (!cancelled) setState(result); });
    return () => { cancelled = true; };
  }, []);

  const saved = useCallback((statuses: SecretStatus[], options: { close: boolean }) => {
    if (options.close) setEditingTool(null);
    setState((current) => current.status === "ready" ? { status: "ready", overview: { ...current.overview, secrets: current.overview.secrets.map((item) => statuses.find((status) => status.key === item.key) ?? item) } } : current);
  }, []);

  const masterKeyCreated = useCallback((overview: SecretsOverview) => {
    setCreatingMasterKey(false);
    setState({ status: "ready", overview });
  }, []);

  if (state.status === "loading") return <p aria-busy="true" className="admin-dashboard__empty">Đang tải danh sách khóa…</p>;
  if (state.status === "error") return <AdminNotice tone="error">{state.message}</AdminNotice>;
  return <IntegrationSecretsView creatingMasterKey={creatingMasterKey} editingTool={editingTool} masterKeyForm={<MasterKeyForm onCancel={() => setCreatingMasterKey(false)} onDone={masterKeyCreated} />} onCloseEdit={() => setEditingTool(null)} onCloseMasterKey={() => setCreatingMasterKey(false)} onCreateMasterKey={() => setCreatingMasterKey(true)} onEditTool={setEditingTool} overview={state.overview}
    renderForm={(tool, secrets) => <ToolSecretsForm key={tool.id} onCancel={() => setEditingTool(null)} onSaved={saved} secrets={secrets} tool={tool} />} />;
}
