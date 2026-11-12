import { z } from "zod";

export function assertCategoryParent(nodes: readonly { id: string; parentId: string | null }[], id: string | null, parentId: string | null) {
  if (!parentId) return;
  const byId = new Map(nodes.map(node => [node.id, node.parentId]));
  if (parentId === id || !byId.has(parentId)) {
    throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "Chuyên mục cha không hợp lệ." }]);
  }
  const visited = new Set<string>();
  let current: string | null = parentId;
  while (current) {
    if (current === id || visited.has(current)) {
      throw new z.ZodError([{ code: "custom", path: ["parentId"], message: "Không thể chọn chuyên mục con làm chuyên mục cha." }]);
    }
    visited.add(current);
    current = byId.get(current) ?? null;
  }
}
