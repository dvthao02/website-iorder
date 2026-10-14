import assert from "node:assert/strict";
import { test } from "node:test";
import { AdminFilterTabsContent as AdminFilterTabs } from "./admin-filter-tabs";
type TestButton = { props: { tabIndex?: number; "aria-selected"?: boolean; disabled?: boolean } };

test("Tab lọc chỉ đưa tab đang chọn vào chuỗi Tab, giữ disabled", () => {
  const items = [{ label: "A", value: "a" }, { label: "B", value: "b" }];
  const element = AdminFilterTabs({ ariaLabel: "Bộ lọc", items, value: "b", onValueChange: () => undefined });
  assert.deepEqual(element.props.children.map((button: TestButton) => button.props.tabIndex), [-1, 0]);
  assert.deepEqual(element.props.children.map((button: TestButton) => button.props["aria-selected"]), [false, true]);
  const locked = AdminFilterTabs({ ariaLabel: "Bộ lọc", items, value: "b", disabled: true, onValueChange: () => undefined });
  assert.ok(locked.props.children.every((button: TestButton) => button.props.disabled));
});
test("Mũi tên/Home/End cập nhật focus và chọn đúng tab, disabled không xử lý", () => {
  let selected = "";
  let focused = -1;
  let prevented = 0;
  const items = [{ label: "A", value: "a" }, { label: "B", value: "b" }];
  const element = AdminFilterTabs({ ariaLabel: "Bộ lọc", items, value: "a", onValueChange: value => { selected = value; } });
  const event = (key: string) => ({ key, preventDefault: () => { prevented++; }, currentTarget: { parentElement: { querySelectorAll: () => items.map((_, index) => ({ focus: () => { focused = index; } })) } } });
  for (const [key, index] of [["ArrowRight", 1], ["ArrowLeft", 1], ["Home", 0], ["End", 1]] as const) {
    element.props.children[0].props.onKeyDown(event(key));
    assert.equal(focused, index);
    assert.equal(selected, items[index].value);
  }
  assert.equal(prevented, 4);
  element.props.children[0].props.onKeyDown(event("Tab"));
  assert.equal(prevented, 4);
  const locked = AdminFilterTabs({ ariaLabel: "Bộ lọc", items, value: "a", disabled: true, onValueChange: () => { throw new Error("Không được chuyển khi khóa"); } });
  locked.props.children[0].props.onKeyDown(event("ArrowRight"));
  assert.equal(prevented, 4);
});
