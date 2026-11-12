import { z } from "zod";
import type { RedirectInput } from "./redirects.contract";

export function assertNoRedirectCycle(rows: readonly ({ id: string } & Pick<RedirectInput, "sourcePath" | "destinationPath" | "isEnabled">)[], id: string | null, values: RedirectInput) {
  if (!values.isEnabled) return;
  const destinations = new Map(rows.filter(row => row.id !== id && row.isEnabled).map(row => [row.sourcePath, row.destinationPath]));
  destinations.set(values.sourcePath, values.destinationPath);
  const visited = new Set<string>();
  let current: string | undefined = values.sourcePath;
  while (current !== undefined) {
    if (visited.has(current)) throw new z.ZodError([{ code: "custom", path: ["destinationPath"], message: "Chuyển hướng tạo vòng lặp. Hãy chọn đường dẫn đích khác." }]);
    visited.add(current);
    const destination = destinations.get(current);
    current = destination === undefined ? undefined : new URL(destination, "https://redirect.invalid").pathname;
  }
}
