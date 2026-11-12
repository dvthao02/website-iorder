// Lịch sử Hoàn tác / Làm lại cho trình dựng trang. Thuần dữ liệu (không phụ thuộc React) để kiểm thử được.
// Các thay đổi liên tiếp cách nhau dưới `mergeWindowMs` (gõ chữ, kéo thanh trượt) gộp thành một bước để Hoàn tác không phải bấm hàng chục lần.

export type EditHistory<T> = { past: T[]; future: T[]; lastAt: number };

export const mergeWindowMs = 800;
export const historyLimit = 100;

export function emptyHistory<T>(): EditHistory<T> {
  return { past: [], future: [], lastAt: 0 };
}

/** Ghi lại trạng thái `before` (trước thay đổi mới). Thay đổi mới xóa nhánh Làm lại. */
export function recordEdit<T>(history: EditHistory<T>, before: T, now: number): EditHistory<T> {
  if (history.past.length && now - history.lastAt < mergeWindowMs) return { past: history.past, future: [], lastAt: now };
  return { past: [...history.past, before].slice(-historyLimit), future: [], lastAt: now };
}

/** Lùi một bước: trả về trạng thái cũ và lịch sử mới (trạng thái hiện tại chuyển sang nhánh Làm lại); null nếu không còn gì để lùi. */
export function undoEdit<T>(history: EditHistory<T>, current: T): { history: EditHistory<T>; value: T } | null {
  if (!history.past.length) return null;
  return { value: history.past[history.past.length - 1], history: { past: history.past.slice(0, -1), future: [current, ...history.future], lastAt: 0 } };
}

export function redoEdit<T>(history: EditHistory<T>, current: T): { history: EditHistory<T>; value: T } | null {
  if (!history.future.length) return null;
  return { value: history.future[0], history: { past: [...history.past, current].slice(-historyLimit), future: history.future.slice(1), lastAt: 0 } };
}
