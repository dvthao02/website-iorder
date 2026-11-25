import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { users } from "@iorder/shared/db/schema";
import { currentRequestContext } from "../shared/request-context";

// Tài khoản ẩn (users.is_hidden, mặc định là tài khoản quản trị gốc do scripts/seed-admin.ts tạo): chỉ chính nó thấy mình.
// Với mọi tài khoản khác nó không có trong danh sách tài khoản, số thành viên của vai trò, ô chọn người phụ trách, bộ lọc nhật ký…;
// tên của nó ở nơi còn phải hiện (nhật ký, liên hệ được giao, bài đã khóa) thành `hiddenAccountLabel`; không sửa, khóa hay xóa được.
// Người đang xem lấy từ ngữ cảnh request (request-context.ts › viewerId, do getCurrentAdministrator điền), nên truy vấn nào dùng helper
// ở đây cũng tự che đúng mà không phải truyền tham số qua từng tầng. Không có người xem (script, tác vụ nền) thì coi như người lạ.

/** Tên hiện thay cho tài khoản ẩn với mọi người khác. */
export const hiddenAccountLabel = "Quản trị hệ thống";

type UserColumns = { id: AnyPgColumn; isHidden: AnyPgColumn; fullName: AnyPgColumn; username: AnyPgColumn };

export function currentViewerId() {
  return currentRequestContext()?.viewerId ?? null;
}

/**
 * true khi dòng users này là tài khoản ẩn và người đang xem không phải chính nó; false khi không có dòng (nối ngoài không khớp),
 * nên dùng được cho cả nối trong lẫn nối ngoài. `table` là bảng users hoặc một bí danh của nó.
 */
export function hiddenFromViewer(table: UserColumns = users, viewerId = currentViewerId()): SQL<boolean> {
  return viewerId
    ? sql<boolean>`coalesce(${table.isHidden} and ${table.id} is distinct from ${viewerId}::uuid, false)`
    : sql<boolean>`coalesce(${table.isHidden}, false)`;
}

/** Điều kiện chỉ lấy tài khoản người đang xem được thấy (đặt trong WHERE, hoặc AND vào điều kiện nối). */
export function visibleUser(table: UserColumns = users, viewerId = currentViewerId()): SQL<boolean> {
  return sql<boolean>`not ${hiddenFromViewer(table, viewerId)}`;
}

/** Họ tên để hiển thị: tài khoản ẩn đổi thành `hiddenAccountLabel` với người khác; null khi nối ngoài không có dòng. */
export function shownFullName<T extends string | null = string>(table: UserColumns = users, viewerId = currentViewerId()): SQL<T> {
  return sql<T>`case when ${hiddenFromViewer(table, viewerId)} then ${hiddenAccountLabel} else ${table.fullName} end`;
}

/** Tên đăng nhập để hiển thị: tài khoản ẩn không lộ tên đăng nhập (null). */
export function shownUsername(table: UserColumns = users, viewerId = currentViewerId()): SQL<string | null> {
  return sql<string | null>`case when ${hiddenFromViewer(table, viewerId)} then null else ${table.username} end`;
}

/** Điều kiện cho cột mã người thực hiện của một bảng khác (nhật ký…): loại các dòng của tài khoản ẩn (trừ khi người xem chính là nó). */
export function visibleActor(userIdColumn: AnyPgColumn, viewerId = currentViewerId()): SQL<boolean> {
  return sql<boolean>`not exists (select 1 from users hidden_user where hidden_user.id = ${userIdColumn} and hidden_user.is_hidden and hidden_user.id is distinct from ${viewerId}::uuid)`;
}

/** Mã đối tượng của dòng nhật ký: trả null nếu đối tượng là tài khoản ẩn (ví dụ dòng đăng nhập ghi mã tài khoản). */
export function visibleEntityId(entityIdColumn: AnyPgColumn, viewerId = currentViewerId()): SQL<string | null> {
  return sql<string | null>`case when exists (select 1 from users hidden_user where hidden_user.id = ${entityIdColumn} and hidden_user.is_hidden and hidden_user.id is distinct from ${viewerId}::uuid) then null else ${entityIdColumn} end`;
}
