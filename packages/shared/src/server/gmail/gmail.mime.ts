// Dựng thư văn bản (text/plain, UTF-8) theo RFC 5322 và RFC 2047 cho Gmail API (users.messages.send nhận thư thô mã hóa base64url).
// Hàm thuần, không đụng mạng. Mọi giá trị đưa vào tiêu đề đều bị loại ký tự xuống dòng để không ai chèn thêm tiêu đề (header injection).

const crlf = "\r\n";

/** Giá trị tiêu đề một dòng: bỏ mọi ký tự xuống dòng (kể cả U+2028/2029). */
export function cleanHeaderValue(value: string) {
  return value.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}

/** Tiêu đề có chữ ngoài ASCII (tiếng Việt) phải mã hóa dạng =?UTF-8?B?…?=; mỗi mảnh tối đa 45 byte và không cắt giữa một ký tự. */
export function encodeHeaderText(value: string) {
  const clean = cleanHeaderValue(value);
  if (/^[\x20-\x7e]*$/.test(clean)) return clean;
  const chunks: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of clean) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 45) { chunks.push(current); current = ""; bytes = 0; }
    current += character;
    bytes += size;
  }
  if (current) chunks.push(current);
  return chunks.map((chunk) => `=?UTF-8?B?${Buffer.from(chunk, "utf8").toString("base64")}?=`).join(`${crlf} `);
}

/** Địa chỉ trong From/To/Cc chỉ gồm một email trơn: không khoảng trắng, dấu phẩy, ngoặc hay dấu nháy. */
function assertAddress(address: string) {
  if (!/^[^\s<>,;"\\()]+@[^\s<>,;"\\()]+$/.test(address)) throw new Error("Địa chỉ email không hợp lệ.");
  return address;
}

function wrapBase64(value: string) {
  return (value.match(/.{1,76}/g) ?? []).join(crlf);
}

export type MimeInput = { from: string; to: string[]; cc?: string[]; subject: string; text: string };

export function buildMimeMessage({ from, to, cc = [], subject, text }: MimeInput) {
  const recipients = to.map(assertAddress);
  if (!recipients.length) throw new Error("Thư cần ít nhất một người nhận.");
  // Người nhận chính không lặp lại ở CC; CC không trùng nhau.
  const copies = [...new Set(cc.map(assertAddress))].filter((address) => !recipients.includes(address));
  const body = Buffer.from(text.replace(/\r?\n/g, crlf), "utf8").toString("base64");
  return [
    `From: ${assertAddress(from)}`,
    `To: ${recipients.join(", ")}`,
    ...(copies.length ? [`Cc: ${copies.join(", ")}`] : []),
    `Subject: ${encodeHeaderText(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(body),
  ].join(crlf);
}

/** Gmail API nhận trường `raw` là thư mã hóa base64url. */
export function toBase64Url(message: string) {
  return Buffer.from(message, "utf8").toString("base64url");
}
