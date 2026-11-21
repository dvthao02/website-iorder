// Suy ra thương hiệu từ tên/mã model khi tên có ghi rõ hãng. Chỉ dùng để điền dữ liệu cũ một lần (scripts/backfill-equipment-brand.ts);
// tên không ghi hãng (ví dụ "Máy POS mini cầm tay", "Giấy in nhiệt K80x80") trả null để người vận hành tự điền, không đoán.
const brandRules: ReadonlyArray<readonly [RegExp, string]> = [
  [/\biorder\b|\biod\s?\d{2,3}\b/i, "iOrder"],
  [/\bsunmi\b/i, "Sunmi"],
  [/\bzywell\b/i, "Zywell"],
  [/\bdatamax\b/i, "Datamax"],
  [/\bats[-\s]?\d{3,4}/i, "ATS"],
  [/\bxprinter\b/i, "Xprinter"],
  [/\bjiantaokj\b/i, "Jiantaokj"],
  // QRBox là loa thông báo của Bảo Kim.
  [/\bqrbox\b|\bb[aả]o\s?kim\b/i, "Bảo Kim"],
];

export function inferEquipmentBrand(name: string, modelCode?: string | null): string | null {
  const text = `${name} ${modelCode ?? ""}`;
  return brandRules.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}
