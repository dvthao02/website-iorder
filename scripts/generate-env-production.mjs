#!/usr/bin/env node
// Tạo `.env.production` từ `.env.production.example`: điền tên miền và sinh chuỗi ngẫu nhiên cho mọi khóa bí mật (đúng độ dài/định dạng ở docs/DEPLOY_CHECKLIST.md).
// Không in giá trị bí mật ra màn hình; tệp ghi ra có quyền 600 (chỉ chủ tệp đọc được) và đã nằm trong .gitignore (.env*).
//
// Dùng:
//   node scripts/generate-env-production.mjs --site example.com --admin admin.example.com --stats stats.example.com
//   node scripts/generate-env-production.mjs ... --from /duong/dan/env-cu     (giữ nguyên các giá trị đã có ở tệp cũ)
//   node scripts/generate-env-production.mjs ... --force                      (ghi đè tệp đã có; tệp cũ được sao thành .env.production.bak-<thời điểm>)
//
// QUAN TRỌNG khi hệ thống đã chạy và có dữ liệu: mật khẩu PostgreSQL, khóa S3 (SeaweedFS) và khóa Umami được ghi vào volume lúc khởi tạo lần đầu.
// Đổi chúng trong .env.production KHÔNG đổi giá trị bên trong volume, Backend sẽ không kết nối được. Khi dựng lại tệp cho hệ thống đang chạy, hãy lấy giá trị cũ
// (tệp env cũ, hoặc `docker inspect` các container db/storage/umami) và truyền bằng --from để script giữ nguyên.
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
const force = args.includes("--force");
const template = resolve(option("template") ?? ".env.production.example");
const target = resolve(option("out") ?? ".env.production");
const fromFile = option("from");

const hex = (bytes) => randomBytes(bytes).toString("hex");
// Cách sinh theo docs/DEPLOY_CHECKLIST.md. Mật khẩu quản trị chỉ gồm chữ, số, `-` và `_` để dán vào tệp env không cần bọc nháy.
const generators = {
  POSTGRES_PASSWORD: () => hex(24),
  LEAD_IP_HASH_SALT: () => hex(32),
  PUBLISH_WEB_REVALIDATE_SECRET: () => hex(32),
  S3_ACCESS_KEY_ID: () => hex(12),
  S3_SECRET_ACCESS_KEY: () => hex(32),
  UMAMI_APP_SECRET: () => hex(32),
  UMAMI_TWO_FACTOR_ENCRYPTION_KEY: () => hex(32),
  INITIAL_ADMIN_PASSWORD: () => randomBytes(18).toString("base64url"),
};
const given = { SITE_ADDRESS: option("site"), ADMIN_SITE_ADDRESS: option("admin"), ANALYTICS_SITE_ADDRESS: option("stats"), INITIAL_ADMIN_USERNAME: option("admin-user") };
// Biến compose.production.yaml bắt buộc có giá trị (`${VAR:?missing}`).
const required = ["SITE_ADDRESS", "ADMIN_SITE_ADDRESS", "ANALYTICS_SITE_ADDRESS", "POSTGRES_DB", "POSTGRES_USER", "POSTGRES_PASSWORD", "LEAD_IP_HASH_SALT", "PUBLISH_WEB_REVALIDATE_SECRET", "S3_ACCESS_KEY_ID", "S3_BUCKET", "S3_SECRET_ACCESS_KEY", "UMAMI_APP_SECRET", "UMAMI_TWO_FACTOR_ENCRYPTION_KEY"];

const fail = (message) => { console.error(`Lỗi: ${message}`); process.exit(1); };
const parse = (text) => Object.fromEntries(text.split(/\r?\n/).flatMap((line) => { const match = /^([A-Z0-9_]+)=(.*)$/.exec(line); return match ? [[match[1], match[2]]] : []; }));

if (!existsSync(template)) fail(`Không thấy tệp mẫu ${template}. Chạy từ thư mục gốc của dự án.`);
if (existsSync(target) && !force) fail(`${target} đã có. Thêm --force để ghi đè (tệp cũ được sao lưu trước), hoặc dùng --out để ghi sang tệp khác.`);
if (fromFile && !existsSync(resolve(fromFile))) fail(`Không thấy tệp --from ${fromFile}.`);
const previous = fromFile ? parse(readFileSync(resolve(fromFile), "utf8")) : {};

const created = [];
const kept = [];
const lines = readFileSync(template, "utf8").split(/\r?\n/).map((line) => {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (!match) return line;
  const [, key, value] = match;
  if (previous[key]) { kept.push(key); return `${key}=${previous[key]}`; }
  if (given[key]) return `${key}=${given[key]}`;
  if (generators[key]) { created.push(key); return `${key}=${generators[key]()}`; }
  return `${key}=${value}`;
});
const output = lines.join("\n");
const values = parse(output);

const missing = required.filter((key) => !values[key]);
if (missing.length) fail(`Thiếu giá trị bắt buộc: ${missing.join(", ")}.`);
const samples = ["SITE_ADDRESS", "ADMIN_SITE_ADDRESS", "ANALYTICS_SITE_ADDRESS"].filter((key) => /(^|\.)example\.com$/.test(values[key]));

if (existsSync(target)) copyFileSync(target, `${target}.bak-${Date.now()}`);
writeFileSync(target, output, { encoding: "utf8", mode: 0o600 });
try { chmodSync(target, 0o600); } catch { /* Windows không có quyền kiểu Unix */ }

console.log(`Đã tạo ${target}`);
console.log(`- Khóa mới sinh ngẫu nhiên (${created.length}): ${created.join(", ") || "không có"}`);
if (kept.length) console.log(`- Giữ nguyên từ tệp cũ (${kept.length}): ${kept.join(", ")}`);
if (samples.length) console.log(`- Còn tên miền mẫu example.com ở: ${samples.join(", ")}. Điền bằng --site/--admin/--stats hoặc sửa tay.`);
console.log(`- Tài khoản CMS đầu tiên: ${values.INITIAL_ADMIN_USERNAME} (mật khẩu nằm ở INITIAL_ADMIN_PASSWORD trong tệp; đổi ở CMS sau lần đăng nhập đầu).`);
console.log("- Giá trị bí mật không được in ra. Sao lưu tệp này vào trình quản lý mật khẩu; không đưa lên git.");
