// Loại tệp thư viện media chấp nhận. Chỉ chứa hằng số và hàm thuần (không phụ thuộc Node) để CMS dùng chung với máy chủ.
// Nhận dạng thật theo nội dung tệp nằm ở media.service.ts (detectUploadedFileType); danh sách ở đây quyết định loại nào được chọn ở từng chỗ dùng.

/** Ảnh dùng được trên website (ảnh khối, ảnh nền, logo, ảnh trong bài…). */
export const imageMediaTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml"] as const;

/**
 * Ảnh bìa, ảnh chia sẻ Facebook/Zalo/Twitter, ảnh schema và ảnh đại diện: mạng xã hội và Google không hiện SVG hay AVIF
 * (GIF thì mất chuyển động), nên các chỗ này chỉ nhận ba định dạng phổ biến.
 */
export const socialImageMediaTypes = ["image/png", "image/jpeg", "image/webp"] as const;

export const officeMediaTypes = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

/**
 * Tệp tải xuống: PDF, tệp nén và tài liệu Office. Không nhận tệp chạy được (.exe, .msi, .apk, .dmg…): loại đó giữ dạng link ngoài
 * (xem importAdminMediaFromUrl) để không phát tán tệp cài đặt do CMS lưu.
 */
export const documentMediaTypes = [
  "application/pdf", "application/zip", "application/vnd.rar", "application/x-7z-compressed", "application/gzip",
  officeMediaTypes.docx, officeMediaTypes.xlsx, officeMediaTypes.pptx,
] as const;

export const imageMediaFormats = "PNG, JPEG, WebP, GIF, AVIF hoặc SVG";
export const socialImageMediaFormats = "PNG, JPEG hoặc WebP";
export const documentMediaFormats = "PDF, ZIP, RAR, 7Z, GZ, Word (.docx), Excel (.xlsx) hoặc PowerPoint (.pptx)";

/** Giá trị cho thuộc tính accept của ô chọn tệp: đuôi tệp đi kèm MIME vì RAR và 7Z có MIME khác nhau tùy trình duyệt. */
export const documentMediaAccept = ".pdf,.zip,.rar,.7z,.gz,.docx,.xlsx,.pptx";
export const imageMediaAccept = imageMediaTypes.join(",");
export const socialImageMediaAccept = socialImageMediaTypes.join(",");
export const anyMediaAccept = `${imageMediaAccept},${documentMediaAccept}`;

const within = (list: readonly string[], mimeType: string) => list.includes(mimeType);
export const isImageMediaType = (mimeType: string) => within(imageMediaTypes, mimeType);
export const isSocialImageMediaType = (mimeType: string) => within(socialImageMediaTypes, mimeType);
export const isDocumentMediaType = (mimeType: string) => within(documentMediaTypes, mimeType);
