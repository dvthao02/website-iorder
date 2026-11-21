import assert from "node:assert/strict";
import http from "node:http";
import type https from "node:https";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { fetchRemoteFile, guardedLookup, isBlockedAddress, parseExternalHttpsUrl, RemoteFileError, suggestedFileName } from "./remote-file";

test("Địa chỉ nội bộ, loopback, link-local, metadata và dải dành riêng bị chặn", () => {
  for (const address of [
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "127.255.255.254", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "192.0.2.5",
    "198.18.0.1", "198.51.100.7", "203.0.113.9", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::1.2.3.4",
    "2001:db8::1", "2001::1", "2002:c0a8:101::1", "64:ff9b::808:808", "fec0::1", "not-an-ip", "",
  ]) assert.equal(isBlockedAddress(address), true, address);
});

test("Địa chỉ công cộng được phép", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "172.15.255.255", "172.32.0.1", "100.63.255.255", "100.128.0.1", "192.167.1.1", "93.184.216.34", "2606:4700:4700::1111", "2a00:1450:4001:81b::200e", "::ffff:8.8.8.8"]) {
    assert.equal(isBlockedAddress(address), false, address);
  }
});

test("Link tải về chỉ nhận https hợp lệ, không tài khoản, không quá dài", () => {
  assert.equal(parseExternalHttpsUrl("  https://example.com/a/b.zip?x=1  ").toString(), "https://example.com/a/b.zip?x=1");
  for (const bad of ["", "   ", "http://example.com/a.zip", "ftp://example.com/a.zip", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "//example.com/a", "example.com/a.zip", "https://user:pass@example.com/a.zip", "https://user@example.com/a.zip", `https://example.com/${"a".repeat(1000)}`]) {
    assert.throws(() => parseExternalHttpsUrl(bad), (error: unknown) => error instanceof RemoteFileError && error.code === "invalid_url", bad);
  }
});

test("Tên tệp gợi ý lấy từ Content-Disposition rồi tới đường dẫn, đã làm sạch", () => {
  const url = new URL("https://example.com/download/iOrder%20Setup.zip");
  assert.equal(suggestedFileName(url, `attachment; filename="driver.pdf"`), "driver.pdf");
  assert.equal(suggestedFileName(url, "attachment; filename*=UTF-8''C%C3%A0i%20%C4%91%E1%BA%B7t.zip"), "Cài đặt.zip");
  assert.equal(suggestedFileName(url, undefined), "iOrder Setup.zip");
  assert.equal(suggestedFileName(url, `attachment; filename="..\\..\\evil.exe"`), "evil.exe");
  assert.equal(suggestedFileName(new URL("https://example.com/"), undefined), null);
});

test("Tra DNS bị chặn khi tên máy chủ trỏ về địa chỉ nội bộ", async () => {
  const error = await new Promise<unknown>((resolve) => guardedLookup("localhost", { all: true }, (lookupError) => resolve(lookupError)));
  assert.ok(error instanceof RemoteFileError && error.code === "blocked");
});

// Máy chủ http cục bộ giả làm máy chủ tải về; hàm gửi yêu cầu đổi https → http và tra DNS luôn về 127.0.0.1 (chỉ trong kiểm thử).
const viaHttp = ((url: URL, options: http.RequestOptions, callback: (response: http.IncomingMessage) => void) =>
  http.request(new URL(url.toString().replace(/^https:/, "http:")), options, callback)) as unknown as typeof https.request;
const toLoopback = ((_host: string, options: { all?: boolean }, callback: (error: null, address: unknown, family?: number) => void) =>
  options.all ? callback(null, [{ address: "127.0.0.1", family: 4 }]) : callback(null, "127.0.0.1", 4)) as unknown as typeof guardedLookup;
const anyPort = () => true;

async function withServer(handler: http.RequestListener, run: (base: string) => Promise<void>) {
  const server = http.createServer(handler);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try { await run(`https://localhost:${(server.address() as AddressInfo).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
const fetchOptions = { maxBytes: 1024, request: viaHttp, lookup: toLoopback, allowPort: anyPort };
const failsWith = (code: string) => (error: unknown) => error instanceof RemoteFileError && error.code === code;

test("Tải được tệp, ghi nhận loại nội dung và tên tệp", async () => {
  await withServer((_request, response) => { response.writeHead(200, { "content-type": "application/zip; charset=binary", "content-disposition": `attachment; filename="goi-cai-dat.zip"` }); response.end("PK\u0003\u0004data"); }, async (base) => {
    const file = await fetchRemoteFile(`${base}/tai-ve`, fetchOptions);
    assert.equal(file.body.toString("latin1"), "PK\u0003\u0004data");
    assert.equal(file.contentType, "application/zip");
    assert.equal(file.fileName, "goi-cai-dat.zip");
  });
});

test("Theo chuyển hướng từng bước và kiểm lại mỗi bước", async () => {
  await withServer((request, response) => {
    if (request.url === "/a") { response.writeHead(302, { location: "/b" }); response.end(); return; }
    if (request.url === "/b") { response.writeHead(301, { location: `https://localhost:${(request.socket.localPort)}/c.pdf` }); response.end(); return; }
    response.writeHead(200, { "content-type": "application/pdf" }); response.end("%PDF-1.4");
  }, async (base) => {
    const file = await fetchRemoteFile(`${base}/a`, fetchOptions);
    assert.equal(file.body.toString(), "%PDF-1.4");
    assert.equal(file.fileName, "c.pdf");
  });
  // Chuyển hướng sang http:// bị từ chối, vòng chuyển hướng quá dài bị dừng.
  await withServer((_request, response) => { response.writeHead(302, { location: "http://example.com/x.zip" }); response.end(); }, async (base) => {
    await assert.rejects(fetchRemoteFile(`${base}/x`, fetchOptions), failsWith("invalid_url"));
  });
  await withServer((request, response) => { response.writeHead(302, { location: `${request.url}` }); response.end(); }, async (base) => {
    await assert.rejects(fetchRemoteFile(`${base}/loop`, { ...fetchOptions, maxRedirects: 2 }), failsWith("too_many_redirects"));
  });
});

test("Mã lỗi HTTP, tệp quá lớn (khai báo hoặc đọc dần) và hết thời gian đều bị từ chối đúng mã", async () => {
  await withServer((_request, response) => { response.writeHead(404); response.end("no"); }, async (base) => {
    await assert.rejects(fetchRemoteFile(`${base}/x`, fetchOptions), (error: unknown) => error instanceof RemoteFileError && error.code === "http_status" && error.status === 404);
  });
  await withServer((_request, response) => { response.writeHead(200, { "content-length": "5000" }); response.end("x".repeat(5000)); }, async (base) => {
    await assert.rejects(fetchRemoteFile(`${base}/x`, fetchOptions), failsWith("too_large"));
  });
  await withServer((_request, response) => { response.writeHead(200); response.write("x".repeat(600)); setTimeout(() => response.end("x".repeat(600)), 20); }, async (base) => {
    await assert.rejects(fetchRemoteFile(`${base}/x`, fetchOptions), failsWith("too_large"));
  });
  await withServer(() => { /* không trả lời */ }, async (base) => {
    await assert.rejects(fetchRemoteFile(`${base}/x`, { ...fetchOptions, timeoutMs: 150 }), failsWith("timeout"));
  });
});

test("Chặn cổng khác 443, địa chỉ IP nội bộ ghi thẳng trong link và tên máy chủ trỏ về mạng nội bộ", async () => {
  await assert.rejects(fetchRemoteFile("https://example.com:8443/a.zip", { maxBytes: 1024 }), failsWith("blocked"));
  for (const target of ["https://127.0.0.1/a.zip", "https://169.254.169.254/latest/meta-data", "https://[::1]/a.zip", "https://[::ffff:10.0.0.1]/a.zip", "https://10.0.0.5/a.zip"]) {
    await assert.rejects(fetchRemoteFile(target, { maxBytes: 1024 }), failsWith("blocked"), target);
  }
  // Dùng hàm tra DNS thật: "localhost" luôn về loopback nên phải bị chặn ngay lúc kết nối.
  await assert.rejects(fetchRemoteFile("https://localhost/a.zip", { maxBytes: 1024, timeoutMs: 3000 }), failsWith("blocked"));
});

test("Link sai định dạng bị từ chối trước khi gửi bất kỳ yêu cầu nào", async () => {
  await assert.rejects(fetchRemoteFile("http://example.com/a.zip", { maxBytes: 1024 }), failsWith("invalid_url"));
  await assert.rejects(fetchRemoteFile("https://user:pw@example.com/a.zip", { maxBytes: 1024 }), failsWith("invalid_url"));
});
