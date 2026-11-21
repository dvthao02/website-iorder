let pending: { key: string; expires: number } | undefined;
function key(url: string) {
  const parsed = new URL(url, "http://cms.local");
  parsed.searchParams.sort();
  return parsed.pathname + parsed.search;
}
export function requestNavigationFocus(url: string, now = Date.now()) {
  pending = { key: key(url), expires: now + 10000 };
}
export function consumeNavigationFocus(url: string, now = Date.now()) {
  if (!pending) return false;
  if (now >= pending.expires) { pending = undefined; return false; }
  if (pending.key !== key(url)) return false;
  pending = undefined;
  return true;
}
