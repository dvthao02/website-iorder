import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminButton } from "./admin-button";

test("Nút thường mặc định không submit và giữ thuộc tính", () => {
  const onClick = () => undefined;
  const button = AdminButton({ children: "Lưu", disabled: true, title: "Lưu nội dung", onClick });
  assert.equal(button.type, "button");
  assert.equal(button.props.type, "button");
  assert.equal(button.props.disabled, true);
  assert.equal(button.props.title, "Lưu nội dung");
  assert.equal(button.props.onClick, onClick);
});

test("Nút submit giữ type và class theo biến thể", () => {
  const button = AdminButton({ children: "Lưu", type: "submit", variant: "secondary", className: "custom" });
  assert.equal(button.props.type, "submit");
  assert.equal(button.props.className, "admin-button admin-button--secondary custom");
  assert.equal(button.props.variant, undefined);
});

test("Link giữ nhãn truy cập, sự kiện và tùy chọn điều hướng", () => {
  const onClick = () => undefined;
  const onNavigate = () => undefined;
  const link = AdminButton({ children: "Mở", href: "/admin/thiet-bi", "aria-label": "Mở thiết bị", title: "Thiết bị", target: "_blank", rel: "noreferrer", onClick, onNavigate, prefetch: false, scroll: false, replace: true });
  assert.equal(link.props.href, "/admin/thiet-bi");
  assert.equal(link.props["aria-label"], "Mở thiết bị");
  assert.equal(link.props.title, "Thiết bị");
  assert.equal(link.props.onClick, onClick);
  assert.equal(link.props.onNavigate, onNavigate);
  assert.equal(link.props.prefetch, false);
  assert.equal(link.props.scroll, false);
  assert.equal(link.props.replace, true);
  assert.equal(link.props.target, "_blank");
  assert.equal(link.props.rel, "noreferrer");
  assert.equal(link.props.type, undefined);
  assert.equal(link.props.leadingIcon, undefined);
});

test("Href rỗng vẫn là link, không tự biến thành nút submit", () => {
  const link = AdminButton({ children: "Mở", href: "" });
  assert.notEqual(link.type, "button");
  assert.equal(link.props.href, "");
});

test("Nút có permission ngoài CMS shell vẫn bấm được; backend vẫn là nơi quyết định", () => {
  const html = renderToStaticMarkup(<AdminButton permission="posts.update">Lưu</AdminButton>);
  assert.match(html, /<button/);
  assert.doesNotMatch(html, /disabled/);
});

test("Danh sách permission: chỉ cần một quyền là bấm được", async () => {
  const { AdminPermissionsProvider } = await import("./admin-permissions");
  const render = (permissions: string[]) => renderToStaticMarkup(<AdminPermissionsProvider actor={{ role: "editor", permissions }}><AdminButton permission={["pages.update", "posts.update"]}>Lưu</AdminButton></AdminPermissionsProvider>);
  assert.doesNotMatch(render(["posts.update"]), /disabled/);
  assert.match(render(["posts.view"]), /disabled/);
});
