// Hình dạng các đợt pháo hoa của trang đăng nhập mùa Giáng sinh. Hàm thuần (nhận hàm ngẫu nhiên từ ngoài) để test được.
// Mỗi hạt có vận tốc ban đầu (px/s); lực cản làm chúng chậm dần nên các hạt "đóng băng" thành hình trước khi rơi.

export const patterns = ["peony", "ring", "star", "tree", "willow"] as const;
export type Pattern = (typeof patterns)[number];
export type Vector = { x: number; y: number };

const speed = 215;

/** Lấy `count` điểm cách đều theo chiều dài dọc một đường gấp khúc khép kín. */
function sampleClosedPath(points: Vector[], count: number): Vector[] {
  const edges = points.map((from, index) => {
    const to = points[(index + 1) % points.length];
    return { from, to, length: Math.hypot(to.x - from.x, to.y - from.y) };
  });
  const perimeter = edges.reduce((sum, edge) => sum + edge.length, 0);
  const result: Vector[] = [];
  let edgeIndex = 0;
  let edgeStart = 0;
  for (let index = 0; index < count; index += 1) {
    const distance = (index / count) * perimeter;
    while (edgeIndex < edges.length - 1 && distance > edgeStart + edges[edgeIndex].length) {
      edgeStart += edges[edgeIndex].length;
      edgeIndex += 1;
    }
    const edge = edges[edgeIndex];
    const t = edge.length === 0 ? 0 : (distance - edgeStart) / edge.length;
    result.push({ x: edge.from.x + (edge.to.x - edge.from.x) * t, y: edge.from.y + (edge.to.y - edge.from.y) * t });
  }
  return result;
}

const starOutline: Vector[] = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? 1 : 0.42;
  const angle = (Math.PI / 5) * index - Math.PI / 2;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
});

// Cây thông ba tầng có thân, đỉnh hướng lên (y âm là phía trên).
const treeOutline: Vector[] = [
  { x: 0, y: -1 }, { x: 0.42, y: -0.4 }, { x: 0.2, y: -0.4 }, { x: 0.62, y: 0.1 }, { x: 0.3, y: 0.1 }, { x: 0.88, y: 0.66 },
  { x: 0.15, y: 0.66 }, { x: 0.15, y: 0.96 }, { x: -0.15, y: 0.96 }, { x: -0.15, y: 0.66 }, { x: -0.88, y: 0.66 }, { x: -0.3, y: 0.1 },
  { x: -0.62, y: 0.1 }, { x: -0.2, y: -0.4 }, { x: -0.42, y: -0.4 },
];

/** Vận tốc ban đầu của từng hạt trong một đợt nổ. `random` trả số trong [0, 1). */
export function burstVelocities(pattern: Pattern, random: () => number): Vector[] {
  switch (pattern) {
    case "ring":
      return Array.from({ length: 56 }, (_, index) => {
        const angle = (index / 56) * Math.PI * 2 + (random() - 0.5) * 0.04;
        const length = speed * (0.97 + random() * 0.06);
        return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
      });
    case "star":
      return sampleClosedPath(starOutline, 70).map((point) => ({ x: point.x * speed + (random() - 0.5) * 6, y: point.y * speed + (random() - 0.5) * 6 }));
    case "tree":
      return sampleClosedPath(treeOutline, 96).map((point) => ({ x: point.x * speed + (random() - 0.5) * 5, y: point.y * speed + (random() - 0.5) * 5 }));
    case "willow":
      return Array.from({ length: 64 }, () => {
        const angle = random() * Math.PI * 2;
        const length = 90 + random() * 120;
        return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
      });
    case "peony":
    default:
      return Array.from({ length: 78 }, () => {
        const angle = random() * Math.PI * 2;
        const length = 60 + Math.pow(random(), 0.6) * 200;
        return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
      });
  }
}

/** Đặc tính vật lý theo kiểu: willow rơi chậm và sáng lâu, hình khối (star, tree) cản mạnh để giữ dáng. */
export const patternTraits: Record<Pattern, { drag: number; gravity: number; life: [number, number] }> = {
  peony: { drag: 0.16, gravity: 130, life: [1.1, 1.7] },
  ring: { drag: 0.14, gravity: 110, life: [1.2, 1.6] },
  star: { drag: 0.1, gravity: 70, life: [1.5, 1.9] },
  tree: { drag: 0.08, gravity: 60, life: [1.7, 2.1] },
  willow: { drag: 0.3, gravity: 210, life: [2.0, 2.8] },
};
