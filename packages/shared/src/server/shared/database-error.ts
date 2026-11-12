/** Inspect driver codes without exposing SQL, parameters, or error messages. */
export function hasDatabaseErrorCode(error: unknown, code: string): boolean {
  const visited = new Set<object>();
  let current = error;
  while (typeof current === "object" && current !== null && !visited.has(current)) {
    visited.add(current);
    if ("code" in current && current.code === code) return true;
    current = "cause" in current ? current.cause : undefined;
  }
  return false;
}
