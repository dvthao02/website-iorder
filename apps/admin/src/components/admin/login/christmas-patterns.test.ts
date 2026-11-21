import assert from "node:assert/strict";
import test from "node:test";

import { burstVelocities, patterns, patternTraits, type Pattern } from "./christmas-patterns";

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const magnitudes = (pattern: Pattern) => burstVelocities(pattern, seeded(7)).map((vector) => Math.hypot(vector.x, vector.y));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

test("Mọi kiểu pháo hoa cho đủ hạt, số hữu hạn và có đặc tính vật lý", () => {
  for (const pattern of patterns) {
    const vectors = burstVelocities(pattern, seeded(1));
    assert.ok(vectors.length >= 50, `${pattern}: ${vectors.length} hạt`);
    for (const vector of vectors) assert.ok(Number.isFinite(vector.x) && Number.isFinite(vector.y), pattern);
    const traits = patternTraits[pattern];
    assert.ok(traits.drag > 0 && traits.drag < 1 && traits.gravity > 0 && traits.life[0] < traits.life[1], pattern);
  }
});

test("Cùng hạt giống thì cùng kết quả, khác hạt giống thì khác", () => {
  for (const pattern of patterns) {
    assert.deepEqual(burstVelocities(pattern, seeded(5)), burstVelocities(pattern, seeded(5)), pattern);
    assert.notDeepEqual(burstVelocities(pattern, seeded(5)), burstVelocities(pattern, seeded(6)), pattern);
  }
});

test("Vòng tròn: mọi hạt cùng tốc độ (sai số dưới 4%)", () => {
  const values = magnitudes("ring");
  const average = mean(values);
  for (const value of values) assert.ok(Math.abs(value - average) / average < 0.04, String(value));
});

test("Ngôi sao năm cánh: đủ mũi nhọn và chỗ lõm, tâm cân bằng", () => {
  const vectors = burstVelocities("star", seeded(2));
  const values = vectors.map((vector) => Math.hypot(vector.x, vector.y));
  assert.ok(Math.max(...values) > 200 && Math.max(...values) < 225, `mũi nhọn ${Math.max(...values)}`);
  assert.ok(Math.min(...values) > 80 && Math.min(...values) < 110, `chỗ lõm ${Math.min(...values)}`);
  assert.ok(Math.abs(mean(vectors.map((vector) => vector.x))) < 12);
  // Đỉnh hướng lên: điểm cao nhất (y âm nhất) gần trục dọc.
  const top = vectors.reduce((best, vector) => (vector.y < best.y ? vector : best));
  assert.ok(Math.abs(top.x) < 40 && top.y < -190, JSON.stringify(top));
});

test("Cây thông: đỉnh nhọn ở trên, thân ở dưới và đối xứng hai bên", () => {
  const vectors = burstVelocities("tree", seeded(3));
  const top = Math.min(...vectors.map((vector) => vector.y));
  const bottom = Math.max(...vectors.map((vector) => vector.y));
  assert.ok(top < -205 && bottom > 195, `cao ${top}, thấp ${bottom}`);
  assert.ok(Math.abs(mean(vectors.map((vector) => vector.x))) < 8);
  // Tầng dưới cùng rộng nhất.
  assert.ok(Math.max(...vectors.map((vector) => Math.abs(vector.x))) > 175);
});
