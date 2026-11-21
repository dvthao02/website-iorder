import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useUnsavedChanges } from "./use-unsaved-changes";

function Probe({ value, baseline }: { value: unknown; baseline?: unknown }) {
  const { isDirty } = useUnsavedChanges(value, baseline);
  return <span>{isDirty ? "dirty" : "clean"}</span>;
}

test("Bản nhập phục hồi so với baseline đã lưu vẫn dirty", () => {
  assert.equal(renderToStaticMarkup(<Probe value={{ title: "Bản nhập  " }} baseline={{ title: "Đã lưu" }} />), "<span>dirty</span>");
  assert.equal(renderToStaticMarkup(<Probe value={{ title: "Đã lưu" }} baseline={{ title: "Đã lưu" }} />), "<span>clean</span>");
});
test("Caller không truyền baseline giữ trạng thái sạch ban đầu", () => {
  assert.equal(renderToStaticMarkup(<Probe value={{ title: "Ban đầu" }} />), "<span>clean</span>");
});

test("Giá trị phục hồi lấy baseline, trả clone độc lập", () => {
  function SavedProbe() {
    const baseline = { title: "Đã lưu", blocks: [{ text: "Nội dung gốc" }] };
    const { getSavedValue } = useUnsavedChanges({ title: "Bản nhập", blocks: [] }, baseline);
    const first = getSavedValue();
    first.blocks[0].text = "Đã đổi bản trả về";
    assert.equal(getSavedValue().blocks[0].text, "Nội dung gốc");
    assert.equal(baseline.blocks[0].text, "Nội dung gốc");
    return <span>{getSavedValue().title}</span>;
  }
  assert.equal(renderToStaticMarkup(<SavedProbe />), "<span>Đã lưu</span>");
});
