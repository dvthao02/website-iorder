type TreeItem = { key: string; parentKey: string | null };

// Mọi con cháu của một mục menu, theo thứ tự cha trước con (duyệt theo chiều sâu, giữ thứ tự từ CMS).
// Website hiện tối đa 2 cấp nên cấp sâu hơn được gộp phẳng vào cấp 2 thay vì bị bỏ mất.
export function descendantsOf<T extends TreeItem>(items: readonly T[], key: string): T[] {
  const result: T[] = [];
  const visited = new Set<string>([key]);
  const walk = (parentKey: string) => {
    for (const item of items) {
      if (item.parentKey !== parentKey || visited.has(item.key)) continue;
      visited.add(item.key);
      result.push(item);
      walk(item.key);
    }
  };
  walk(key);
  return result;
}
