import assert from "node:assert/strict";
import test from "node:test";

import { resolveSettingHref, resolveSettingLinks, settingLinkFallback, settingLinkHref, settingLinkKey } from "./setting-links";

const links = { appLogin: "https://app.iorder.vn/login", trial: "https://app.iorder.vn/register-trial", facebook: null, zalo: null, youtube: null, appStore: null, googlePlay: null };

test("Mã setting: đổi sang địa chỉ trong Cài đặt, đường dẫn thường giữ nguyên", () => {
  assert.equal(resolveSettingHref(settingLinkHref("trial"), links), links.trial);
  assert.equal(resolveSettingHref("/lien-he#tu-van", links), "/lien-he#tu-van");
  assert.equal(resolveSettingHref("https://example.com", links), "https://example.com");
});

test("Cài đặt chưa có địa chỉ hoặc mã lạ thì về trang Liên hệ", () => {
  assert.equal(resolveSettingHref(settingLinkHref("trial"), { ...links, trial: null }), settingLinkFallback);
  assert.equal(resolveSettingHref("setting:trial", null), settingLinkFallback);
  assert.equal(resolveSettingHref("setting:facebook", links), settingLinkFallback);
  assert.equal(settingLinkKey("setting:facebook"), null);
  assert.equal(settingLinkKey("setting:appLogin"), "appLogin");
});

test("Đổi mọi href lồng trong dữ liệu khối, không đụng trường khác", () => {
  const data = { title: "setting:trial", primaryAction: { label: "Dùng thử", href: "setting:trial" }, panels: [{ secondaryAction: { label: "Xem", href: "/phan-mem" } }], items: [{ href: null }] };
  assert.deepEqual(resolveSettingLinks(data, links), { title: "setting:trial", primaryAction: { label: "Dùng thử", href: links.trial }, panels: [{ secondaryAction: { label: "Xem", href: "/phan-mem" } }], items: [{ href: null }] });
});
