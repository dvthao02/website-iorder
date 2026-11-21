import dns from "node:dns";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import net from "node:net";

import { parseExternalHttpsUrl, RemoteFileError } from "./external-url";

/**
 * Tải một tệp từ link do người vận hành nhập (nhập tệp cài đặt từ link vào thư viện) mà không để máy chủ bị lợi dụng truy cập mạng nội bộ (SSRF):
 * chỉ https, chỉ cổng 443, không kèm tài khoản/mật khẩu trong link; mọi địa chỉ IP (nội bộ, loopback, link-local, metadata đám mây, dải dành riêng…)
 * bị chặn ở đúng lúc kết nối nên DNS đổi đáp án giữa chừng cũng không vượt qua được; chuyển hướng được kiểm tra lại từng bước; giới hạn dung lượng,
 * thời gian và số lần chuyển hướng; không nhận nội dung nén.
 */

// Kiểm link và lỗi dùng chung nằm ở external-url.ts (không dùng API của Node để giao diện quản trị import được); xuất lại ở đây cho nơi tải tệp.
export { maxExternalUrlLength, parseExternalHttpsUrl, RemoteFileError, type RemoteFileErrorCode } from "./external-url";

const ipv4Blocked: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function ipv4ToNumber(address: string) {
  return address.split(".").reduce((total, part) => total * 256 + Number(part), 0);
}

function isBlockedIPv4(address: string) {
  const value = ipv4ToNumber(address);
  return ipv4Blocked.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    return Math.floor(value / size) === Math.floor(ipv4ToNumber(base) / size);
  });
}

/** Tách IPv6 thành 8 nhóm 16 bit (hỗ trợ "::" và đuôi IPv4); null nếu không đọc được. */
function ipv6Groups(address: string): number[] | null {
  let text = address.split("%")[0].toLowerCase();
  const tail = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    if (net.isIP(tail[1]) !== 4) return null;
    const value = ipv4ToNumber(tail[1]);
    text = `${text.slice(0, -tail[1].length)}${Math.floor(value / 65536).toString(16)}:${(value % 65536).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...(halves.length === 2 ? Array(missing).fill("0") : []), ...rest].map(part => (/^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : NaN));
  return groups.length === 8 && groups.every(Number.isFinite) ? groups : null;
}

function isBlockedIPv6(address: string) {
  const groups = ipv6Groups(address);
  if (!groups) return true;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  // IPv4 nhúng (::ffff:a.b.c.d): xét theo luật của IPv4.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return isBlockedIPv4(`${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`);
  // Chỉ nhận địa chỉ toàn cầu 2000::/3; loại thêm tài liệu 2001:db8::/32, Teredo 2001::/32, 6to4 2002::/16.
  if ((g0 & 0xe000) !== 0x2000) return true;
  if (g0 === 0x2001 && (g1 === 0x0db8 || g1 === 0)) return true;
  if (g0 === 0x2002) return true;
  return false;
}

/** Địa chỉ IP có bị chặn không (nội bộ, loopback, link-local, metadata, dải dành riêng, multicast…). Chuỗi không phải IP coi là bị chặn. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;

/** Tra DNS rồi kiểm từng địa chỉ NGAY LÚC KẾT NỐI: socket chỉ nối tới địa chỉ đã được duyệt. */
export function guardedLookup(hostname: string, options: dns.LookupOptions, callback: LookupCallback) {
  dns.lookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(entry => isBlockedAddress(entry.address))) return callback(new RemoteFileError("blocked", "Link trỏ tới địa chỉ nội bộ hoặc không được phép."));
    return options.all ? callback(null, addresses) : callback(null, addresses[0].address, addresses[0].family);
  });
}

function headerFileName(disposition: string | undefined) {
  if (!disposition) return null;
  const encoded = disposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/);
  if (encoded) { try { return decodeURIComponent(encoded[1].trim()); } catch { /* bỏ qua, thử dạng thường */ } }
  const plain = disposition.match(/filename\s*=\s*"?([^";]+)"?/);
  return plain ? plain[1].trim() : null;
}

/** Tên tệp gợi ý: từ tiêu đề Content-Disposition, không có thì đoạn cuối của đường dẫn. Đã bỏ ký tự điều khiển và dấu phân cách thư mục. */
export function suggestedFileName(url: URL, disposition: string | undefined) {
  let name = headerFileName(disposition);
  if (!name) {
    const last = url.pathname.split("/").filter(Boolean).at(-1);
    if (last) { try { name = decodeURIComponent(last); } catch { name = last; } }
  }
  const clean = (name ?? "").split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, "_").trim().slice(0, 200) ?? "";
  return clean || null;
}

export type RemoteFile = { body: Buffer; contentType: string | null; fileName: string | null; finalUrl: string };
export type FetchRemoteFileOptions = {
  maxBytes: number;
  timeoutMs?: number;
  maxRedirects?: number;
  // Chỉ dùng cho kiểm thử: thay hàm gửi yêu cầu, hàm tra DNS và luật cổng.
  request?: typeof https.request;
  lookup?: typeof guardedLookup;
  allowPort?: (port: string) => boolean;
};

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function timedOut(signal: AbortSignal) {
  return signal.aborted ? new RemoteFileError("timeout", "Máy chủ của link phản hồi quá lâu.") : new RemoteFileError("unreachable", "Kết nối bị ngắt khi đang tải tệp.");
}

function requestOnce(url: URL, send: typeof https.request, lookup: typeof guardedLookup, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const request = send(url, {
      method: "GET",
      agent: false,
      lookup: lookup as unknown as typeof dns.lookup,
      headers: { "User-Agent": "iOrder-CMS-import/1.0", Accept: "*/*", "Accept-Encoding": "identity" },
    }, resolve);
    const abort = () => request.destroy(new RemoteFileError("timeout", "Máy chủ của link phản hồi quá lâu."));
    signal.addEventListener("abort", abort, { once: true });
    request.on("close", () => signal.removeEventListener("abort", abort));
    request.on("error", (error) => reject(error instanceof RemoteFileError ? error : new RemoteFileError("unreachable", "Không kết nối được tới máy chủ của link.")));
    request.end();
  });
}

/** Tải tệp từ link https đã qua kiểm tra. Ném `RemoteFileError` với mã cụ thể khi không tải được. */
export async function fetchRemoteFile(rawUrl: string, options: FetchRemoteFileOptions): Promise<RemoteFile> {
  const { maxBytes, timeoutMs = 30_000, maxRedirects = 3 } = options;
  const send = options.request ?? https.request;
  const lookup = options.lookup ?? guardedLookup;
  const allowPort = options.allowPort ?? ((port: string) => port === "" || port === "443");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let url = parseExternalHttpsUrl(rawUrl);
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      if (!allowPort(url.port)) throw new RemoteFileError("blocked", "Chỉ tải được từ link dùng cổng https mặc định (443).");
      // Link ghi thẳng địa chỉ IP không đi qua tra DNS nên phải kiểm ngay tại đây.
      const bare = url.hostname.replace(/^\[|\]$/g, "");
      if (net.isIP(bare) && isBlockedAddress(bare)) throw new RemoteFileError("blocked", "Link trỏ tới địa chỉ nội bộ hoặc không được phép.");
      const response = await requestOnce(url, send, lookup, controller.signal);
      const status = response.statusCode ?? 0;
      if (redirectStatuses.has(status)) {
        response.resume();
        const location = response.headers.location;
        if (!location) throw new RemoteFileError("http_status", "Link chuyển hướng nhưng không cho biết địa chỉ mới.", status);
        if (hop === maxRedirects) throw new RemoteFileError("too_many_redirects", "Link chuyển hướng quá nhiều lần.");
        url = parseExternalHttpsUrl(new URL(location, url).toString());
        continue;
      }
      if (status !== 200) { response.resume(); throw new RemoteFileError("http_status", `Máy chủ của link trả về lỗi (mã ${status}).`, status); }
      const declared = Number(response.headers["content-length"]);
      if (Number.isFinite(declared) && declared > maxBytes) { response.destroy(); throw new RemoteFileError("too_large", "Tệp quá lớn."); }
      const chunks: Buffer[] = [];
      let total = 0;
      await new Promise<void>((resolve, reject) => {
        response.on("data", (chunk: Buffer) => {
          total += chunk.length;
          // Báo lỗi trước rồi mới hủy kết nối: hủy sẽ phát sự kiện "aborted" và lỗi đầu tiên mới là lỗi được trả về.
          if (total > maxBytes) { reject(new RemoteFileError("too_large", "Tệp quá lớn.")); response.destroy(); return; }
          chunks.push(chunk);
        });
        response.on("end", resolve);
        response.on("error", (error) => reject(error instanceof RemoteFileError ? error : timedOut(controller.signal)));
        response.on("aborted", () => reject(timedOut(controller.signal)));
      });
      const type = response.headers["content-type"];
      return {
        body: Buffer.concat(chunks),
        contentType: typeof type === "string" ? type.split(";")[0].trim().toLowerCase() || null : null,
        fileName: suggestedFileName(url, response.headers["content-disposition"]),
        finalUrl: url.toString(),
      };
    }
    throw new RemoteFileError("too_many_redirects", "Link chuyển hướng quá nhiều lần.");
  } finally {
    clearTimeout(timer);
  }
}
