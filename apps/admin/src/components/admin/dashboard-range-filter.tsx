import Link from "next/link";
import React from "react";

import { dashboardRanges, defaultDashboardRange, type DashboardRange } from "@iorder/shared/server/dashboard/dashboard-range";

/** Bộ lọc khoảng thời gian của Tổng quan (7 / 30 / 90 ngày): liên kết thuần, khoảng đã chọn nằm trong địa chỉ nên chia sẻ và tải lại vẫn giữ. */
export function DashboardRangeFilter({ value }: { value: DashboardRange }) {
  return <nav aria-label="Khoảng thời gian thống kê" className="admin-range-filter">
    {dashboardRanges.map((range) => <Link aria-current={range === value ? "true" : undefined} className="admin-range-filter__item" href={range === defaultDashboardRange ? "/admin" : `/admin?range=${range}`} key={range} scroll={false}>{range} ngày</Link>)}
  </nav>;
}
