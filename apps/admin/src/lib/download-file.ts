/** Tên file trong tiêu đề Content-Disposition (`attachment; filename="x.xlsx"` hoặc `filename*=UTF-8''…`); không có hoặc không an toàn thì dùng tên dự phòng. */
export function fileNameFromDisposition(header: string | null | undefined, fallback: string) {
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header ?? "")?.[1];
  let name: string | undefined;
  if (encoded) { try { name = decodeURIComponent(encoded.trim()); } catch { name = undefined; } }
  name ??= /filename\s*=\s*"?([^";]+)"?/i.exec(header ?? "")?.[1]?.trim();
  return name && !/[\\/]/.test(name) ? name : fallback;
}

/**
 * Lưu nội dung một phản hồi đã tải xong thành file trên máy người dùng (tên theo Content-Disposition của máy chủ) và trả về tên file.
 * Dùng thay cho liên kết `download` khi cần bắt lỗi: liên kết lỗi sẽ mở trang JSON thay vì báo bằng thông báo của CMS.
 */
export async function saveResponseAsFile(response: Response, fallbackName: string) {
  const name = fileNameFromDisposition(response.headers.get("content-disposition"), fallbackName);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Trình duyệt cần một lúc để bắt đầu ghi file trước khi địa chỉ tạm bị thu hồi.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return name;
}
