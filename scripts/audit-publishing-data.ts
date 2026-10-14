import { config } from "dotenv";
import postgres from "postgres";
import { publishingConfigSchema } from "../packages/core/src/server/settings/publishing.contract";

config({ quiet: true });
async function main() {
  const connection = process.env.DATABASE_URL;
  if (!connection || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(connection).hostname)) throw new Error("Chỉ audit DB local.");
  const client = postgres(connection, { max: 1, prepare: false, onnotice: () => undefined });
  try {
    const publishing = await client.begin(async tx => {
      await tx`set transaction read only`;
      await tx`set local statement_timeout='8000'`;
      const rows = await tx<{ value: { siteUrl?: unknown } }[]>`select value from public.site_settings where key='publishing'`;
      let invalid = 0;
      let nonHttp = 0;
      let credentials = 0;
      let pathQueryHash = 0;
      for (const row of rows) {
        if (row.value.siteUrl === null) continue;
        try {
          if (typeof row.value.siteUrl !== "string") { invalid++; continue; }
          const url = new URL(row.value.siteUrl);
          if (!["http:", "https:"].includes(url.protocol)) nonHttp++;
          if (url.username || url.password) credentials++;
          if (url.pathname !== "/" || url.search || url.hash) pathQueryHash++;
        } catch { invalid++; }
      }
      console.log(JSON.stringify({ rows: rows.length, invalid, nonHttp, credentials, pathQueryHash }));
      if (invalid || nonHttp || credentials) process.exitCode = 1;
      const parsed = publishingConfigSchema.safeParse(rows[0]?.value);
      if (!parsed.success) throw new Error("Cấu hình không hợp lệ hoặc chưa tồn tại.");
      return parsed.data;
    });
    const [robots, sitemap] = await Promise.all(["robots.txt", "sitemap.xml"].map(async path => {
      const response = await fetch(`http://127.0.0.1:3000/${path}`, { redirect: "manual", signal: AbortSignal.timeout(15000) });
      return { status: response.status, text: await response.text(), type: response.headers.get("content-type") ?? "" };
    }));
    const lines = robots.text.split(/\r?\n/).map(line => line.trim());
    const disallow = lines.filter(line => /^Disallow:/i.test(line)).map(line => line.slice(line.indexOf(":") + 1).trim());
    const advertised = lines.filter(line => /^Sitemap:/i.test(line)).map(line => line.slice(line.indexOf(":") + 1).trim());
    const robotsRulesMatch = lines.includes("User-Agent: *") && (publishing.allowSearchIndexing
      ? lines.includes("Allow: /") && disallow.includes("/admin/") && disallow.includes("/api/") && !disallow.includes("/")
      : disallow.includes("/") && !lines.includes("Allow: /"));
    const advertisedMatch = publishing.siteUrl
      ? advertised.length === 1 && advertised[0] === new URL("/sitemap.xml", publishing.siteUrl).href
      : advertised.length === 0;
    const locations = Array.from(sitemap.text.matchAll(/<loc>([^<]*)<\/loc>/g), match => match[1]);
    let invalidLocations = 0;
    for (const location of locations) {
      try {
        const url = new URL(location);
        if (!publishing.siteUrl || url.origin !== new URL(publishing.siteUrl).origin || !["http:", "https:"].includes(url.protocol) || url.username || url.password) invalidLocations++;
      } catch { invalidLocations++; }
    }
    const duplicates = locations.length - new Set(locations).size;
    const sitemapShape = sitemap.type.includes("xml") && sitemap.text.includes("<urlset") && sitemap.text.includes("</urlset>");
    const countMatch = publishing.siteUrl ? locations.length > 0 : locations.length === 0;
    const passed = robots.status === 200 && sitemap.status === 200 && robotsRulesMatch && advertisedMatch && sitemapShape && countMatch && !invalidLocations && !duplicates;
    console.log(JSON.stringify({ robotsStatus: robots.status, sitemapStatus: sitemap.status, robotsRulesMatch, advertisedMatch, sitemapShape, locations: locations.length, invalidLocations, duplicates, passed }));
    console.log("Kiểm HTTP local theo cấu hình DB; không follow URL sitemap, không ghi dữ liệu. Kiểm cấu trúc cơ bản, không phải XML validator hoặc kiểm toàn bộ nội dung xuất bản.");
    if (!passed) process.exitCode = 1;
  } finally { await client.end({ timeout: 10 }); }
}
main().catch(() => { console.error("Không hoàn tất audit cấu hình xuất bản; không in URL, dữ liệu hoặc kết nối."); process.exitCode = 1; });
