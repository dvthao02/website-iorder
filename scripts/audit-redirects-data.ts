import { config } from "dotenv";
import postgres from "postgres";
import { redirectInputSchema } from "../packages/core/src/server/redirects/redirects.contract";
import { assertNoRedirectCycle } from "../packages/core/src/server/redirects/redirect-cycle";

config({ quiet: true });
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) throw new Error("Chỉ audit DB local.");
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  try {
    const validRows = await client.begin(async tx => {
      await tx`set transaction read only`;
      await tx`set local statement_timeout='8000'`;
      const rows = await tx<{ id: string; sourcePath: string; destinationPath: string; statusCode: number; isEnabled: boolean }[]>`
        select id, source_path as "sourcePath", destination_path as "destinationPath", status_code as "statusCode", is_enabled as "isEnabled"
        from public.redirects where deleted_at is null`;
      let invalid = 0;
      let noncanonicalSources = 0;
      let cyclic = 0;
      let excludedProxySources = 0;
      const valid = rows.flatMap(row => {
        const result = redirectInputSchema.safeParse({ sourcePath: row.sourcePath, destinationPath: row.destinationPath, statusCode: row.statusCode, isEnabled: row.isEnabled });
        if (!result.success) { invalid += 1; return []; }
        return [{ id: row.id, ...result.data }];
      });
      for (const row of valid) {
        const source = new URL(row.sourcePath, "https://redirect.invalid");
        if (source.pathname !== row.sourcePath) noncanonicalSources += 1;
        if (source.pathname.startsWith("/api") || source.pathname.startsWith("/admin") || source.pathname === "/login" || source.pathname.includes(".")) excludedProxySources += 1;
        try { assertNoRedirectCycle(valid, row.id, row); } catch { cyclic += 1; }
      }
      console.log(JSON.stringify({ total: rows.length, enabled: rows.filter(row => row.isEnabled).length, invalid, noncanonicalSources, excludedProxySources, enabledPathsEnteringCycle: cyclic }));
      console.log("Audit chỉ đọc DB local; chỉ in số lượng, không in ID/URL và không sửa redirect.");
      return valid;
    });
    let checked = 0;
    let failed = 0;
    const statuses: Record<string, number> = {};
    let locationMismatch = 0;
    let networkFailure = 0;
    for (let offset = 0; offset < validRows.length; offset += 4) {
      await Promise.all(validRows.slice(offset, offset + 4).filter(row => row.isEnabled).map(async row => {
        checked += 1;
        try {
          const source = new URL(row.sourcePath, "http://127.0.0.1:3000");
          source.searchParams.set("cms_audit", "redirect-check");
          const response = await fetch(source, { redirect: "manual", signal: AbortSignal.timeout(10000) });
          const actual = response.headers.get("location");
          statuses[response.status] = (statuses[response.status] ?? 0) + 1;
          const expected = new URL(row.destinationPath, source);
          expected.search = source.search;
          const matches = actual !== null && new URL(actual, source).href === expected.href;
          if (!matches) locationMismatch += 1;
          if (response.status !== row.statusCode || !matches) failed += 1;
          await response.body?.cancel();
        } catch { failed += 1; networkFailure += 1; }
      }));
    }
    console.log(JSON.stringify({ websiteChecked: checked, websitePassed: checked - failed, websiteFailed: failed, statuses, locationMismatch, networkFailure }));
    console.log("Website local: kiểm status/Location và giữ query, không follow redirect; không in URL.");
    if (failed) process.exitCode = 1;
  } finally { await client.end({ timeout: 10 }); }
}
main().catch(() => { console.error("Không hoàn tất audit dữ liệu redirect; không in kết nối hoặc nội dung dữ liệu."); process.exitCode = 1; });
