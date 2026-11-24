export type ImageDimensions = { width: number; height: number };

const maxDimension = 100_000;

function valid(width: number, height: number): ImageDimensions | null {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width <= maxDimension && height <= maxDimension ? { width, height } : null;
}

function readPng(body: Buffer): ImageDimensions | null {
  // 8 byte chữ ký, rồi khối IHDR: độ dài (4) + "IHDR" (4) + rộng (4) + cao (4).
  if (body.length < 24 || body.toString("ascii", 12, 16) !== "IHDR") return null;
  return valid(body.readUInt32BE(16), body.readUInt32BE(20));
}

function readJpeg(body: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 9 < body.length) {
    if (body[offset] !== 0xff) { offset += 1; continue; }
    const marker = body[offset + 1];
    if (marker === 0xff) { offset += 1; continue; }
    // Khối không có độ dài: RSTn, TEM, SOI.
    if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) return null; // hết ảnh hoặc bắt đầu dữ liệu mà chưa gặp SOF
    const length = body.readUInt16BE(offset + 2);
    if (length < 2) return null;
    // SOF0–SOF15 trừ DHT (C4), JPG (C8), DAC (CC) mang kích thước khung hình.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) return valid(body.readUInt16BE(offset + 7), body.readUInt16BE(offset + 5));
    offset += 2 + length;
  }
  return null;
}

function readWebp(body: Buffer): ImageDimensions | null {
  if (body.length < 30) return null;
  const chunk = body.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Khung lossy: sau 3 byte thẻ khung là mã khởi đầu 9d 01 2a, rồi rộng và cao 14 bit.
    if (body[23] !== 0x9d || body[24] !== 0x01 || body[25] !== 0x2a) return null;
    return valid(body.readUInt16LE(26) & 0x3fff, body.readUInt16LE(28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    if (body[20] !== 0x2f) return null;
    const bits = body.readUInt32LE(21);
    return valid((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    return valid(body.readUIntLE(24, 3) + 1, body.readUIntLE(27, 3) + 1);
  }
  return null;
}

function readGif(body: Buffer): ImageDimensions | null {
  // "GIF89a" (6) rồi rộng và cao 16 bit little-endian.
  if (body.length < 10) return null;
  return valid(body.readUInt16LE(6), body.readUInt16LE(8));
}

function readAvif(body: Buffer): ImageDimensions | null {
  // Hộp "ispe" (kích thước ảnh gốc): loại (4) + phiên bản/cờ (4) + rộng (4) + cao (4); nằm trong phần đầu tệp.
  const at = body.subarray(0, 65_536).indexOf("ispe");
  if (at < 0 || at + 16 > body.length) return null;
  return valid(body.readUInt32BE(at + 8), body.readUInt32BE(at + 12));
}

function readSvg(body: Buffer): ImageDimensions | null {
  // Thuộc tính width/height thuần số (px); thiếu thì lấy từ viewBox. Đơn vị phần trăm, em... không biết kích thước thật nên bỏ qua.
  const tag = body.toString("utf8", 0, Math.min(body.length, 4096)).match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const attribute = (name: string) => {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*["']\\s*([0-9.]+)\\s*(?:px)?\\s*["']`, "i"));
    return match ? Number(match[1]) : null;
  };
  let width = attribute("width");
  let height = attribute("height");
  if (!width || !height) {
    const box = tag.match(/viewBox\s*=\s*["']\s*[-0-9.]+[\s,]+[-0-9.]+[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i);
    if (box) { width = Number(box[1]); height = Number(box[2]); }
  }
  return width && height ? valid(Math.round(width), Math.round(height)) : null;
}

/** Đọc rộng × cao từ phần đầu tệp ảnh (PNG, JPEG, WebP, GIF, AVIF, SVG) mà không cần thư viện xử lý ảnh; không đọc được thì trả null. */
export function readImageDimensions(body: Buffer, mimeType: string): ImageDimensions | null {
  try {
    if (mimeType === "image/png") return readPng(body);
    if (mimeType === "image/jpeg") return readJpeg(body);
    if (mimeType === "image/webp") return readWebp(body);
    if (mimeType === "image/gif") return readGif(body);
    if (mimeType === "image/avif") return readAvif(body);
    if (mimeType === "image/svg+xml") return readSvg(body);
  } catch {
    return null;
  }
  return null;
}
