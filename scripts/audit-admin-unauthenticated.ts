import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { revisionTargetSchema } from "../packages/core/src/server/revisions/revisions.contract";

const root = join(process.cwd(), "apps/backend/src/app/api/admin");

async function routes(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? routes(join(directory, entry.name))
    : Promise.resolve(entry.name === "route.ts" ? [join(directory, entry.name)] : [])));
  return groups.flat();
}

async function main() {
  let total = 0;
  const failures: string[] = [];
  for (const file of (await routes(root)).sort()) {
    const route = relative(root, file).replaceAll("\\", "/").replace(/\/route\.ts$/, "");
    // Login/logout có hợp đồng public riêng, không thuộc gate này.
    if (route === "session") continue;
    const source = await readFile(file, "utf8");
    const methods = Array.from(source.matchAll(/export\s+(?:async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(|const\s+(GET|POST|PUT|PATCH|DELETE)\s*=)/g), (match) => match[1] ?? match[2]);
    assert.ok(methods.length, "Route cần được kiểm kê method trước khi audit.");
    const targets = route.includes("[target]") ? revisionTargetSchema.options : ["equipment"];
    const paths = targets.map(target => route.replaceAll("[target]", target).replace(/\[[^\]]+\]/g, "invalid-audit-id"));
    for (const path of paths) for (const method of methods) {
      total += 1;
      try {
        const response = await fetch(`http://127.0.0.1:3002/api/admin/${path}`, {
          method, redirect: "manual", signal: AbortSignal.timeout(20000),
          // Không cookie/credential. Body sai JSON và ID sai tránh mutation hợp lệ.
          ...(method === "POST" || method === "PUT" || method === "PATCH"
            ? { headers: { "content-type": "application/json" }, body: "{" } : {}),
        });
        await response.body?.cancel();
        if (response.status !== 401) failures.push(`${method} /api/admin/${path}: ${response.status}`);
      } catch { failures.push(`${method} /api/admin/${path}: không hoàn tất HTTP`); }
    }
  }
  console.log(`Đã kiểm ${total} method admin không cookie; ${total - failures.length} trả 401.`);
  for (const failure of failures) console.error(failure);
  if (failures.length) process.exitCode = 1;
}

void main().catch(() => {
  console.error("Không hoàn tất kiểm kê route admin local.");
  process.exitCode = 1;
});
