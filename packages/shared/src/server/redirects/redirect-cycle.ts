import { z } from "zod";
import { builtInRedirect, pathnameOf } from "../shared/legacy-paths";
import type { RedirectInput } from "./redirects.contract";

type RedirectRow = { id: string } & Pick<RedirectInput, "sourcePath" | "destinationPath" | "isEnabled">;
type Hop = { to: string; builtIn: boolean };

// Một bước chuyển hướng đúng như website thực hiện (apps/website/src/proxy.ts): bảng chuyển hướng của CMS trước,
// rồi mới đến chuyển hướng có sẵn trong mã (URL tiếng Anh → tiếng Việt, chữ hoa → chữ thường).
function nextHop(destinations: ReadonlyMap<string, string>, path: string): Hop | null {
  const configured = destinations.get(path);
  if (configured !== undefined) {
    const to = pathnameOf(configured);
    return to === null ? null : { to, builtIn: false };
  }
  const to = builtInRedirect(path);
  return to === null ? null : { to, builtIn: true };
}

function enabledDestinations(rows: readonly RedirectRow[], exceptId: string | null) {
  return new Map(rows.filter((row) => row.id !== exceptId && row.isEnabled).map((row) => [row.sourcePath, row.destinationPath]));
}

export function assertNoRedirectCycle(rows: readonly RedirectRow[], id: string | null, values: RedirectInput) {
  if (!values.isEnabled) return;
  const destinations = enabledDestinations(rows, id);
  destinations.set(values.sourcePath, values.destinationPath);
  const trail: { path: string; hop: Hop | null }[] = [];
  const position = new Map<string, number>();
  let current: string | undefined = values.sourcePath;
  while (current !== undefined) {
    const seenAt = position.get(current);
    if (seenAt !== undefined) {
      // Vòng lặp đi qua một chuyển hướng có sẵn trong mã: nói rõ để người dùng hiểu vì sao đường dẫn "bình thường" lại bị từ chối.
      const builtIn = trail.slice(seenAt).find((step) => step.hop?.builtIn);
      const message = builtIn?.hop
        ? `Chuyển hướng tạo vòng lặp: website luôn tự chuyển “${builtIn.path}” về “${builtIn.hop.to}”. Hãy chọn đường dẫn đích khác.`
        : "Chuyển hướng tạo vòng lặp. Hãy chọn đường dẫn đích khác.";
      throw new z.ZodError([{ code: "custom", path: ["destinationPath"], message }]);
    }
    const hop = nextHop(destinations, current);
    position.set(current, trail.length);
    trail.push({ path: current, hop });
    current = hop?.to;
  }
}

/**
 * Đường dẫn cuối cùng khách sẽ tới khi vào `path`, đi hết chuỗi chuyển hướng đang bật (kể cả chuyển hướng có sẵn trong mã).
 * Dùng để trỏ thẳng liên kết nội dung tới đích thật, không để khách đi qua nhiều bước. Gặp vòng lặp (dữ liệu hỏng) thì dừng tại đó.
 */
export function resolveRedirectDestination(rows: readonly RedirectRow[], path: string, exceptId: string | null = null) {
  const destinations = enabledDestinations(rows, exceptId);
  const seen = new Set<string>();
  let current = pathnameOf(path) ?? path;
  for (let hop = nextHop(destinations, current); hop && !seen.has(hop.to); hop = nextHop(destinations, current)) {
    seen.add(current);
    current = hop.to;
  }
  return current;
}
