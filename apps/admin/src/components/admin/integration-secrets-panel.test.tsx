import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { integrationTools, secretMetas, type SecretStatus, type SecretsOverview } from "@iorder/shared/server/secrets/secrets.contract";
import { AdminToastProvider } from "./ui/admin-feedback";
import { IntegrationSecretsView, MasterKeyForm, ToolSecretsForm } from "./integration-secrets-panel";

// AdminCard/AdminNotice dùng JSX kiểu cũ (không tự import React) nên test cần React toàn cục.
(globalThis as { React?: typeof React }).React = React;

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

function status(key: SecretStatus["key"], extra: Partial<SecretStatus> = {}): SecretStatus {
  const meta = secretMetas[key];
  return { key, label: meta.label, description: meta.description, input: meta.input, exposeValue: meta.exposeValue, state: "none", storedInCms: false, envOverrides: false, hint: null, version: 0, updatedAt: null, updatedByName: null, ...(meta.placeholder ? { placeholder: meta.placeholder } : {}), ...extra };
}
const overview = (masterKey: SecretsOverview["masterKey"], secrets: SecretStatus[], extra: Partial<SecretsOverview> = {}): SecretsOverview => ({
  masterKey, masterKeySource: masterKey === "missing" ? "none" : "env", canCreateMasterKey: false, keyFilePath: null, secrets, ...extra,
});
const clean = overview("ok", [status("umami_api_url"), status("umami_website_id"), status("umami_api_key"), status("google_service_account"), status("search_console_property")]);

test("Màn Kết nối & khóa API: chưa có biến nào thì cả năm hiện Chưa đặt, mỗi công cụ chỉ một nút Cấu hình, kèm giải thích khóa chỉ ghi và phải nhập lại mật khẩu", () => {
  const html = renderToStaticMarkup(<IntegrationSecretsView overview={clean} />);
  assert.equal((html.match(/Chưa đặt/g) ?? []).length, 5);
  assert.equal((html.match(/>Cấu hình</g) ?? []).length, 2, "mỗi công cụ chỉ một nút, không nút riêng cho từng biến");
  assert.doesNotMatch(html, /Đặt khóa|Điền giá trị|Thay khóa|Đổi giá trị|Xóa khỏi CMS/);
  assert.match(html, /Umami \(thống kê truy cập\)/);
  assert.match(html, /Google Search Console/);
  assert.equal((html.match(/0\/3 biến đã đặt|0\/2 biến đã đặt/g) ?? []).length, 2, "mỗi công cụ là một thẻ, ghi số biến đã đặt");
  assert.match(html, /UUID|Địa chỉ Umami/);
  assert.match(html, /Khóa bí mật chỉ ghi/);
  assert.match(html, /nhập lại mật khẩu của chính bạn/);
  assert.match(html, /mã hóa/);
  assert.match(html, /biến môi trường tương ứng thì biến[\s\S]*thắng/);
  assert.match(html, /Nhật ký hoạt động/);
  assert.doesNotMatch(html, /<input|<textarea/, "chưa mở biểu mẫu thì không có ô nhập nào");
  assert.doesNotMatch(html, /disabled/, "khóa chủ ổn thì nút bật");
});

test("Màn Kết nối & khóa API: đã đặt thì hiện gợi ý (không lộ khóa), người và thời điểm cập nhật; không có nút xem", () => {
  const stored = overview("ok", [
    status("umami_api_url", { state: "cms", storedInCms: true, hint: "http://umami:3000", version: 1, updatedAt: "2026-11-19T03:00:00.000Z" }),
    status("umami_website_id", { state: "cms", storedInCms: true, hint: "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f", version: 1, updatedAt: "2026-11-19T03:00:00.000Z" }),
    status("google_service_account", { state: "cms", storedInCms: true, hint: "cms@du-an.iam.gserviceaccount.com", version: 2, updatedAt: "2026-11-19T03:00:00.000Z", updatedByName: "Administrator" }),
    status("search_console_property", { state: "cms", storedInCms: true, hint: "sc-domain:iorder.com.vn", version: 1, updatedAt: "2026-11-19T03:00:00.000Z" }),
    status("umami_api_key", { state: "cms", storedInCms: true, hint: "••••7890", version: 1, updatedAt: "2026-11-19T03:00:00.000Z" }),
  ]);
  const html = renderToStaticMarkup(<IntegrationSecretsView overview={stored} />);
  assert.equal((html.match(/Đã đặt ở CMS/g) ?? []).length, 5);
  assert.equal((html.match(/>Cấu hình</g) ?? []).length, 2);
  assert.match(html, /http:\/\/umami:3000/, "địa chỉ và mã website hiện lại được");
  assert.match(html, /3\/3 biến đã đặt/);
  assert.match(html, /2\/2 biến đã đặt/);
  assert.match(html, /cms@du-an\.iam\.gserviceaccount\.com/);
  assert.match(html, /••••7890/);
  assert.match(html, /bởi Administrator/);
  assert.match(html, /sc-domain:iorder\.com\.vn/, "thuộc tính không bí mật nên hiển thị lại giá trị");
  assert.doesNotMatch(html, /Xem khóa|Hiện khóa|Sao chép khóa/);
});

test("Biến môi trường đã đặt thì thắng: cảnh báo nêu tên biến và nói giá trị ở CMS chưa có hiệu lực", () => {
  const envWins = overview("ok", [
    status("google_service_account", { state: "env", envOverrides: true, storedInCms: true, hint: "cms@du-an.iam.gserviceaccount.com" }),
    status("search_console_property"),
    status("umami_api_key", { state: "env", envOverrides: true }),
  ]);
  const html = renderToStaticMarkup(<IntegrationSecretsView overview={envWins} />);
  assert.equal((html.match(/Đang dùng biến môi trường/g) ?? []).length, 2);
  assert.match(html, /GOOGLE_SERVICE_ACCOUNT_JSON<\/code>, <code>GOOGLE_SERVICE_ACCOUNT_FILE/);
  assert.match(html, /UMAMI_API_KEY/);
  assert.match(html, /giá trị ở CMS được giữ nhưng chưa có hiệu lực/);
  assert.match(html, /gỡ biến đó/);
});

test("Chưa có hoặc sai khóa chủ: hướng dẫn tạo khóa chủ, nút Đặt khóa bị khóa; cảnh báo nhắc cất khóa chủ riêng", () => {
  const missing = renderToStaticMarkup(<IntegrationSecretsView overview={overview("missing", clean.secrets)} />);
  assert.match(missing, /Chưa đặt khóa chủ/);
  assert.match(missing, /openssl rand -base64 32/);
  assert.match(missing, /SECRETS_MASTER_KEY/);
  assert.match(missing, /mất khóa này thì phải nhập lại toàn bộ khóa API/);
  assert.equal((missing.match(/disabled=""/g) ?? []).length, 2, "hai nút Cấu hình bị khóa");
  assert.equal((missing.match(/Chưa lưu được: máy chủ chưa có khóa chủ hợp lệ/g) ?? []).length, 2, "mỗi công cụ nói rõ vì sao nút bị khóa, không chỉ khung ở đầu trang");
  assert.doesNotMatch(renderToStaticMarkup(<IntegrationSecretsView overview={clean} />), /Chưa lưu được: máy chủ chưa có khóa chủ/, "khóa chủ ổn thì không hiện dòng này");
  const invalid = renderToStaticMarkup(<IntegrationSecretsView overview={overview("invalid", clean.secrets)} />);
  assert.match(invalid, /sai định dạng/);
  assert.match(invalid, /role="alert"/);
});

test("Khóa chủ: máy chủ cho tạo thì có nút Tạo khóa chủ và giải thích khóa nằm ở tệp riêng, không trong database; mở biểu mẫu thì chỉ cần mật khẩu", () => {
  const creatable = overview("missing", clean.secrets, { canCreateMasterKey: true, keyFilePath: "/data/secrets/master.key" });
  const html = renderToStaticMarkup(<IntegrationSecretsView overview={creatable} />);
  assert.match(html, /Chưa có khóa chủ nên chưa lưu được/);
  assert.match(html, />Tạo khóa chủ</);
  assert.match(html, /\/data\/secrets\/master\.key/);
  assert.match(html, /không nằm trong database hay bản sao lưu database/);
  assert.match(html, /không cần khởi động lại/);
  assert.doesNotMatch(html, /openssl rand/, "không bắt người dùng chạy lệnh khi đã có nút tạo");
  assert.equal((html.match(/disabled=""/g) ?? []).length, 2, "hai nút Cấu hình vẫn khóa cho tới khi có khóa chủ");

  // Biểu mẫu nằm trong panel trượt (portal, chỉ dựng ở trình duyệt) nên kiểm riêng biểu mẫu; khung panel kiểm ở bài kiểm tra mã nguồn bên dưới.
  const opened = renderToStaticMarkup(<AdminToastProvider><MasterKeyForm onCancel={() => undefined} onDone={() => undefined} /></AdminToastProvider>);
  assert.match(opened, /Mật khẩu của bạn \(để xác nhận\)/);
  assert.match(opened, /autoComplete="current-password"/);
  assert.equal((opened.match(/type="password"/g) ?? []).length, 1, "chỉ có ô mật khẩu xác nhận, không ô nhập khóa chủ");
  assert.equal((opened.match(/>Tạo khóa chủ</g) ?? []).length, 1, "nút Tạo khóa chủ nằm trong biểu mẫu");
});

test("Khóa chủ: hiện nguồn đang dùng (tệp có đường dẫn để sao lưu riêng, hoặc biến môi trường); tệp hỏng thì báo và không có nút tạo đè", () => {
  const fromFile = renderToStaticMarkup(<IntegrationSecretsView overview={overview("ok", clean.secrets, { masterKeySource: "file", keyFilePath: "/data/secrets/master.key" })} />);
  assert.match(fromFile, /đang cất trong tệp trên máy chủ/);
  assert.match(fromFile, /\/data\/secrets\/master\.key/);
  assert.match(fromFile, /Sao lưu riêng tệp này/);
  assert.match(fromFile, /mất tệp thì phải nhập lại toàn bộ khóa API/);
  assert.doesNotMatch(fromFile, /disabled=""/);
  assert.doesNotMatch(fromFile, />Tạo khóa chủ</);

  const fromEnv = renderToStaticMarkup(<IntegrationSecretsView overview={overview("ok", clean.secrets)} />);
  assert.match(fromEnv, /Khóa chủ lấy từ biến môi trường/);

  const brokenFile = renderToStaticMarkup(<IntegrationSecretsView overview={overview("invalid", clean.secrets, { masterKeySource: "file", keyFilePath: "/data/secrets/master.key" })} />);
  assert.match(brokenFile, /trong tệp trên máy chủ[\s\S]*không đọc được hoặc/);
  assert.match(brokenFile, /CMS không tự tạo đè lên khóa đã có/);
  assert.doesNotMatch(brokenFile, />Tạo khóa chủ</);
});

test("Biểu mẫu một công cụ: mọi biến trong một panel, một ô mật khẩu xác nhận, một nút Lưu; đúng kiểu ô cho từng loại biến", () => {
  const tool = (id: string) => integrationTools.find((item) => item.id === id)!;
  const render = (id: string, secrets: SecretStatus[]) => renderToStaticMarkup(<AdminToastProvider><ToolSecretsForm onCancel={() => undefined} onSaved={() => undefined} secrets={secrets} tool={tool(id)} /></AdminToastProvider>);

  const umami = render("umami", [status("umami_api_url"), status("umami_website_id"), status("umami_api_key")]);
  assert.match(umami, /Địa chỉ Umami \(API\)/);
  assert.match(umami, /Mã website trong Umami/);
  assert.match(umami, /Umami: API key/);
  assert.match(umami, /placeholder="https:\/\/thongke\.ten-mien\.vn"/);
  assert.equal((umami.match(/type="text"/g) ?? []).length, 2, "địa chỉ và mã website là ô chữ");
  assert.equal((umami.match(/type="password"/g) ?? []).length, 2, "API key và mật khẩu xác nhận là ô ẩn");
  assert.equal((umami.match(/<label[^>]*>Mật khẩu của bạn \(để xác nhận\)<\/label>/g) ?? []).length, 1, "một lần nhập mật khẩu cho cả nhóm");
  assert.match(umami, /aria-label="Giải thích: Mã website trong Umami"/);
  assert.doesNotMatch(umami, /admin-status-note/, "không có dòng mô tả chiếm chỗ dưới ô nhập");
  assert.match(read("apps/admin/src/components/admin/integration-secrets-panel.tsx"), /<AdminFormField error=\{fieldError\(secret\.key, id\)\} hint=\{note\}/, "mô tả từng biến nằm trong chú giải ⓘ cạnh nhãn");
  assert.equal((umami.match(/type="submit"/g) ?? []).length, 1, "một nút Lưu");
  assert.match(umami, /autoComplete="current-password"/);
  assert.doesNotMatch(umami, /Xóa khỏi CMS/, "chưa lưu gì thì chưa có mục xóa");

  const google = render("google_search_console", [status("google_service_account"), status("search_console_property")]);
  assert.match(google, /type="file"/);
  assert.match(google, /accept="application\/json,\.json"/);
  assert.doesNotMatch(google, /<textarea/, "không có ô gõ JSON");
  assert.match(google, /placeholder="sc-domain:ten-mien\.vn"/);

  const stored = render("umami", [
    status("umami_api_url", { state: "cms", storedInCms: true, hint: "http://umami:3000", version: 1 }),
    status("umami_website_id", { state: "cms", storedInCms: true, hint: "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f", version: 1 }),
    status("umami_api_key", { state: "cms", storedInCms: true, hint: "••••7890", version: 1 }),
  ]);
  assert.match(stored, /value="http:\/\/umami:3000"/, "biến không bí mật điền sẵn giá trị đang lưu");
  assert.match(stored, /value="3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f"/);
  assert.doesNotMatch(stored, /••••7890/, "khóa bí mật không bao giờ điền sẵn, kể cả gợi ý");
  assert.match(stored, /Để trống = giữ nguyên/);
  assert.equal((stored.match(/Xóa khỏi CMS/g) ?? []).length, 3, "mỗi biến đã lưu có hộp đánh dấu xóa");
  assert.equal((stored.match(/type="checkbox"/g) ?? []).length, 3);
});

test("Mã nguồn màn: giá trị và mật khẩu bị xóa khỏi state khi lưu xong, không lưu vào localStorage/URL, không đọc biến môi trường; menu và trang chỉ cho Super Admin", () => {
  const panel = read("apps/admin/src/components/admin/integration-secrets-panel.tsx");
  assert.match(panel, /setValues\(\{\}\); setPassword\(""\); setFileNames\(\{\}\);/, "xóa giá trị sau khi lưu");
  assert.ok(!/localStorage|sessionStorage|document\.cookie|process\.env|location\.(search|hash)|console\.(log|info|debug)/.test(panel), "không để lộ giá trị ra ngoài form");
  assert.match(panel, /expectedVersion: secret\.version/, "gửi version để chống ghi đè đồng thời");
  assert.match(panel, /body: JSON\.stringify\(\{ items: toSet\.map/, "lưu cả nhóm biến của công cụ bằng một yêu cầu, một lần xác nhận mật khẩu");
  assert.match(panel, /toSet = secrets\.filter\(\(secret\) => !removed\.has\(secret\.key\) && values\[secret\.key\]\?\.trim\(\) && values\[secret\.key\] !== initialValue\(secret\)\)/, "chỉ gửi biến đã sửa");
  assert.match(panel, /action: "create-master-key", password/, "tạo khóa chủ chỉ gửi mật khẩu xác nhận, không có ô nhập khóa chủ");

  assert.equal((panel.match(/<AdminSidePanel/g) ?? []).length, 2, "mọi biến của một công cụ nằm trong một panel trượt; tạo khóa chủ có panel riêng; không mở tại chỗ");
  assert.match(panel, /onClose=\{\(\) => onCloseEdit\?\.\(\)\}/);
  assert.match(panel, /onCloseEdit=\{\(\) => setEditingTool\(null\)\}/);
  assert.doesNotMatch(panel, /open \? renderForm/, "không còn biểu mẫu mở tại chỗ trong thẻ");

  const shell = read("apps/admin/src/components/admin/admin-shell.tsx");
  assert.match(shell, /href: "\/admin\/integrations", label: "Kết nối & khóa API", icon: KeyRound, superAdminOnly: true/);
  assert.match(shell, /if \(item\.superAdminOnly\) return isSuperAdmin\(administrator\);/);
  assert.match(read("apps/admin/src/app/admin/(protected)/integrations/page.tsx"), /requireSuperAdmin\(\)/);
  assert.match(read("apps/admin/src/lib/admin-guard.ts"), /isSuperAdmin\(administrator\)\) redirect\("\/admin\/forbidden"\)/);
});
