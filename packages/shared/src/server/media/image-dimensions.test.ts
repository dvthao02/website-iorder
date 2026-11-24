import assert from "node:assert/strict";
import test from "node:test";

import { readImageDimensions } from "./image-dimensions";

// Ảnh mẫu 37 × 21 px do bộ mã hóa thật tạo ra (không phải tệp dựng tay), nên kiểm đúng định dạng đang gặp ở thực tế.
const samples = {
  png: "iVBORw0KGgoAAAANSUhEUgAAACUAAAAVCAIAAABOhrD5AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAMElEQVRIiWOQq7hDT8Qwal/FaHjKjaaXO6P5QW60fLkzWn5WjNYPd0br24oh0p4AAMfdYz9lrIzsAAAAAElFTkSuQmCC",
  jpeg: "/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAVACUDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAYH/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AnwGlIIAAAAAAAAAB/9k=",
  webpLossy: "UklGRkgAAABXRUJQVlA4IDwAAABQAwCdASolABUAPtFmrFEoJaQipWgBABoJZwDF9oAAK/fDcAD+3hJ/52thiCpf+tTIx9AE1PwdzJMAAAA=",
  webpLossless: "UklGRh4AAABXRUJQVlA4TBEAAAAvJAAFAAdQvHqUu/+BiOh/AAA=",
  webpAlpha: "UklGRlgAAABXRUJQVlA4WAoAAAAQAAAAJAAAFAAAQUxQSAoAAAABB1DAiAhERP8DVlA4ICgAAADwAgCdASolABUAPtFmrVEoJaQipWgBABoJaQAAKUNt8AD+852AAAAA",
};
const sample = (key: keyof typeof samples) => Buffer.from(samples[key], "base64");

test("đọc kích thước PNG, JPEG và các biến thể WebP", () => {
  assert.deepEqual(readImageDimensions(sample("png"), "image/png"), { width: 37, height: 21 });
  assert.deepEqual(readImageDimensions(sample("jpeg"), "image/jpeg"), { width: 37, height: 21 });
  assert.deepEqual(readImageDimensions(sample("webpLossy"), "image/webp"), { width: 37, height: 21 });
  assert.deepEqual(readImageDimensions(sample("webpLossless"), "image/webp"), { width: 37, height: 21 });
  assert.deepEqual(readImageDimensions(sample("webpAlpha"), "image/webp"), { width: 37, height: 21 });
});

test("đọc kích thước GIF, AVIF và SVG (width/height hoặc viewBox)", () => {
  const gif = Buffer.concat([Buffer.from("GIF89a", "ascii"), Buffer.from([37, 0, 21, 0]), Buffer.alloc(8)]);
  assert.deepEqual(readImageDimensions(gif, "image/gif"), { width: 37, height: 21 });
  const avif = Buffer.concat([Buffer.from([0, 0, 0, 28]), Buffer.from("ftypavif", "ascii"), Buffer.alloc(8), Buffer.from("ispe", "ascii"), Buffer.from([0, 0, 0, 0]), Buffer.from([0, 0, 0, 37]), Buffer.from([0, 0, 0, 21])]);
  assert.deepEqual(readImageDimensions(avif, "image/avif"), { width: 37, height: 21 });
  assert.deepEqual(readImageDimensions(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="40">'), "image/svg+xml"), { width: 120, height: 40 });
  assert.deepEqual(readImageDimensions(Buffer.from('<?xml version="1.0"?><svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg"></svg>'), "image/svg+xml"), { width: 300, height: 100 });
  assert.equal(readImageDimensions(Buffer.from('<svg width="100%" height="50%"></svg>'), "image/svg+xml"), null, "đơn vị phần trăm không cho biết kích thước thật");
  assert.equal(readImageDimensions(Buffer.from("GIF89a"), "image/gif"), null);
  assert.equal(readImageDimensions(Buffer.from("ftypavif"), "image/avif"), null);
});

test("JPEG có khối thông tin chèn trước khung hình vẫn đọc đúng", () => {
  const jpeg = sample("jpeg");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x0a]), Buffer.alloc(8, 0x41)]);
  const withMetadata = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
  assert.deepEqual(readImageDimensions(withMetadata, "image/jpeg"), { width: 37, height: 21 });
});

test("dữ liệu hỏng, cụt hoặc sai loại trả null thay vì ném lỗi", () => {
  assert.equal(readImageDimensions(Buffer.alloc(0), "image/png"), null);
  assert.equal(readImageDimensions(sample("png").subarray(0, 20), "image/png"), null);
  assert.equal(readImageDimensions(sample("jpeg").subarray(0, 30), "image/jpeg"), null);
  assert.equal(readImageDimensions(sample("webpLossy").subarray(0, 28), "image/webp"), null);
  assert.equal(readImageDimensions(sample("png"), "application/pdf"), null);
  assert.equal(readImageDimensions(Buffer.from("not an image at all, just text"), "image/jpeg"), null);
});

test("PNG có kích thước bằng 0 bị từ chối", () => {
  const png = Buffer.from(sample("png"));
  png.writeUInt32BE(0, 16);
  assert.equal(readImageDimensions(png, "image/png"), null);
});
