// Giữ tệp mới khi response GET khởi chạy trước upload trả về chậm.
export function mergeMediaAssets<T extends { id: string }>(remote: T[], uploaded: T[]): T[] {
  const uploadedIds = new Set(uploaded.map((asset) => asset.id));
  return [...uploaded, ...remote.filter((asset) => !uploadedIds.has(asset.id))];
}
