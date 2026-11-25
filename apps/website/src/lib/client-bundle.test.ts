import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

// Mọi component "use client" đã gắn vào layout hoặc trang đều đi cùng bundle JavaScript của khách: thứ gì chúng import (cả gián tiếp) phải tải, phân tích
// và chạy trước khi trang hiện ra. zod một mình là ~30 KB gz (107 KB chưa nén; đo trên trang chủ qua mạng 4G chậm, CPU chậm gấp 4 thì chặn ~0,3 giây).
// Schema zod chỉ dành cho phía máy chủ/CMS; mã trình duyệt dùng module thuần (xem appearance-height.ts, popup-link.ts, builder-preview-message.ts).

const root = process.cwd();
const websiteSource = path.join(root, "apps/website/src");
const sharedSource = path.join(root, "packages/shared/src");

function resolveImport(from: string, specifier: string): string | "zod" | null {
  let base: string;
  if (specifier === "zod") return "zod";
  if (specifier.startsWith("@/")) base = path.join(websiteSource, specifier.slice(2));
  else if (specifier.startsWith("@iorder/shared/")) base = path.join(sharedSource, specifier.slice("@iorder/shared/".length));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(from), specifier);
  else return null;
  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Import/export có giá trị (bỏ `import type` vì bị xóa khi biên dịch). */
function valueImports(file: string) {
  const text = fs.readFileSync(file, "utf8");
  const found: string[] = [];
  for (const match of text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\s+from\s+)?["']([^"']+)["']/g)) if (!match[1]) found.push(match[2]);
  return found;
}

function chainToZod(file: string, seen = new Set<string>(), chain: string[] = []): string[] | null {
  if (seen.has(file)) return null;
  seen.add(file);
  for (const specifier of valueImports(file)) {
    const target = resolveImport(file, specifier);
    if (target === "zod") return [...chain, path.relative(root, file), "zod"];
    if (target) {
      const found = chainToZod(target, seen, [...chain, path.relative(root, file)]);
      if (found) return found;
    }
  }
  return null;
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test("Không component 'use client' nào của website kéo zod vào trình duyệt (trực tiếp hay qua module khác)", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(websiteSource)) {
    if (!/^\s*["']use client["']/.test(fs.readFileSync(file, "utf8").slice(0, 200))) continue;
    const chain = chainToZod(file);
    if (chain) offenders.push(chain.join(" → "));
  }
  assert.deepEqual(offenders, [], "import module thuần (không zod) thay vì contract/schema");
});
