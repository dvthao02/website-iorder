// Địa chỉ trong Cài đặt › Thông tin website có thể có nhiều dòng: mỗi dòng một văn phòng/chi nhánh, dạng "Đà Nẵng: 21 Phạm Nhữ Tăng, …".
// Phần trước dấu hai chấm (không chứa số) là tên chi nhánh; dòng không có tên thì cả dòng là địa chỉ.
export type AddressLine = { text: string; branch: string | null; street: string };

export function addressLines(address: string | null | undefined): AddressLine[] {
  return (address ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text) => {
    const match = /^([^:\d]{2,40}):\s*(\S.*)$/u.exec(text);
    return match ? { text, branch: match[1].trim(), street: match[2].trim() } : { text, branch: null, street: text };
  });
}
