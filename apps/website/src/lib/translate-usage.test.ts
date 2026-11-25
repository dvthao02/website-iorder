import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import * as ts from "typescript";

// Test chạy từ thư mục gốc của repo (pnpm test).
const websiteRoot = path.join(process.cwd(), "apps/website/src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) ? [full] : [];
  });
}

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

// Một hàm hoặc thành phần có tham số/thuộc tính mà giá trị mặc định lấy từ createTranslate() (chữ tiếng Việt trong code): nơi gọi quên truyền thì chữ cố định
// luôn hiện tiếng Việt dù khách chọn ngôn ngữ khác ("Tác giả:", "Tải xuống", thông báo lỗi biểu mẫu từng bị như vậy).
type Requirement = { name: string; kind: "prop"; prop: string } | { name: string; kind: "argument"; index: number };

function requirementsOf(source: ts.SourceFile) {
  const found: Requirement[] = [];
  const inspect = (name: string | undefined, fn: ts.SignatureDeclaration) => {
    if (!name) return;
    fn.parameters.forEach((parameter, index) => {
      if (parameter.initializer?.getText(source).includes("createTranslate(")) found.push({ name, kind: "argument", index });
      if (ts.isObjectBindingPattern(parameter.name)) {
        for (const element of parameter.name.elements) if (element.initializer?.getText(source).includes("createTranslate(") && ts.isIdentifier(element.name)) found.push({ name, kind: "prop", prop: element.name.text });
      }
    });
  };
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) inspect(node.name?.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) inspect(node.name.text, node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test("Nơi dùng thành phần/hàm có chữ mặc định tiếng Việt (createTranslate) đều truyền hàm dịch: không còn chữ cố định bị kẹt tiếng Việt khi khách chọn ngôn ngữ khác", () => {
  const files = sourceFiles(websiteRoot);
  const sources = new Map(files.map((file) => [file, parse(file)]));
  const requirements = [...sources.values()].flatMap(requirementsOf);
  assert.ok(requirements.length >= 8, "phải tìm thấy các thành phần có t mặc định (AuthorByline, DownloadList, AvailabilityBadge…)");

  const violations: string[] = [];
  for (const [file, source] of sources) {
    const relative = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const report = (node: ts.Node, text: string) => violations.push(`${relative}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${text}`);
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const tag = node.tagName.getText(source);
        const attributes = node.attributes.properties;
        const spread = attributes.some((attribute) => ts.isJsxSpreadAttribute(attribute));
        for (const requirement of requirements) {
          if (requirement.kind !== "prop" || requirement.name !== tag || spread) continue;
          if (!attributes.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === requirement.prop)) report(node, `<${tag}> thiếu ${requirement.prop}`);
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const callee = node.expression.text;
        for (const requirement of requirements) {
          if (requirement.kind === "argument" && requirement.name === callee && node.arguments.length <= requirement.index) report(node, `${callee}(…) thiếu đối số thứ ${requirement.index + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(violations, [], `truyền t (getT() ở máy chủ, useT() ở trình duyệt) cho:\n${violations.join("\n")}`);
});
