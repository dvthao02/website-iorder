/** Khóa ngay tại handler, không đợi React render disabled. */
export async function withSinglePendingAction(pending: { current: boolean }, action: () => Promise<void>): Promise<boolean> {
  if (pending.current) return false;
  pending.current = true;
  try {
    await action();
    return true;
  } finally {
    pending.current = false;
  }
}
