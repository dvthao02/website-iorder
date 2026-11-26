import { randomBytes } from "node:crypto";

// Các lần "Kết nối Gmail" đang chờ Google trả về. Giữ trong bộ nhớ của tiến trình Backend (cùng cách với bộ đếm nhập sai mật khẩu ở secrets.service.ts):
// Backend chỉ chạy một tiến trình, nên mất khi khởi động lại chỉ làm người dùng phải bấm Kết nối lần nữa.
// `state` ngẫu nhiên, dùng được đúng một lần, hết hạn sau 10 phút và gắn với tài khoản đã bắt đầu: chặn giả mạo yêu cầu từ trang khác (CSRF).

export type PendingConnection = { userId: string; redirectUri: string; verifier: string };

export function createPendingConnections({ now = () => Date.now(), ttlMs = 10 * 60 * 1000, maxEntries = 20 }: { now?: () => number; ttlMs?: number; maxEntries?: number } = {}) {
  const entries = new Map<string, PendingConnection & { expiresAt: number }>();

  function sweep() {
    const current = now();
    for (const [state, entry] of entries) if (entry.expiresAt <= current) entries.delete(state);
    // Bắt đầu quá nhiều lần mà không hoàn tất: bỏ những lần cũ nhất.
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
  }

  return {
    create(connection: PendingConnection) {
      sweep();
      const state = randomBytes(24).toString("base64url");
      entries.set(state, { ...connection, expiresAt: now() + ttlMs });
      return state;
    },
    /** Lấy và xóa (dùng một lần). Sai tài khoản vẫn xóa: state lộ ra thì không dùng lại được. */
    consume(state: string, userId: string): PendingConnection | null {
      sweep();
      const entry = entries.get(state);
      entries.delete(state);
      if (!entry || entry.userId !== userId) return null;
      return { userId: entry.userId, redirectUri: entry.redirectUri, verifier: entry.verifier };
    },
    size: () => entries.size,
  };
}
