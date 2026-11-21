// Đường dẫn công khai của một tệp media (CMS và website cùng proxy /media/* về Backend).
export function mediaPath(storageKey: string) {
  return `/media/${storageKey.split("/").map(encodeURIComponent).join("/")}`;
}
