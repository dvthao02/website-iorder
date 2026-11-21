// Khoảng thời gian (số ngày) của bộ lọc thống kê ở Tổng quan. Chỉ nhận ba mức cố định để không ai đẩy số lớn vào truy vấn.
export const dashboardRanges = [7, 30, 90] as const;
export type DashboardRange = (typeof dashboardRanges)[number];
export const defaultDashboardRange: DashboardRange = 30;

/** Đọc số ngày từ tham số URL (chuỗi hoặc số); giá trị lạ, rỗng hoặc ngoài ba mức thì dùng mặc định. */
export function parseDashboardRange(value: string | number | null | undefined): DashboardRange {
  const days = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return dashboardRanges.find((range) => range === days) ?? defaultDashboardRange;
}
