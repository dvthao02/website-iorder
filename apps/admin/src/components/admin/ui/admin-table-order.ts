/**
 * Gộp thứ tự cột đã lưu của người dùng với danh sách cột hiện tại.
 * Cột đã bị gỡ thì bỏ; cột mới thêm được chèn ngay sau cột đứng trước nó trong thứ tự mặc định
 * (thay vì rơi xuống cuối bảng, sau cả cột "Thao tác").
 */
export function mergeColumnOrder(savedOrder: readonly string[] | undefined, defaultOrder: readonly string[]): string[] {
  const valid = new Set(defaultOrder);
  const order = [...new Set((savedOrder ?? []).filter((id) => valid.has(id)))];
  defaultOrder.forEach((id, index) => {
    if (order.includes(id)) return;
    const previous = defaultOrder.slice(0, index).reverse().find((candidate) => order.includes(candidate));
    order.splice(previous === undefined ? 0 : order.indexOf(previous) + 1, 0, id);
  });
  return order;
}
