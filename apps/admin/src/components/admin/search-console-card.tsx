"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

import type { SearchConsoleOpportunity, SearchConsoleOverview } from "@iorder/shared/server/search-console/search-console.contract";
import { AdminApiError, requestAdminJson } from "../../lib/admin-api";
import { AdminCard } from "./ui/admin-card";

const numberFormat = new Intl.NumberFormat("vi-VN");
const decimalFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1, style: "percent" });

const reasonLabels: Record<SearchConsoleOpportunity["reason"], string> = {
  near_page_one: "Gần trang đầu",
  low_ctr: "Ít người bấm",
};
const reasonHints: Record<SearchConsoleOpportunity["reason"], string> = {
  near_page_one: "Đang ở trang 2: cải thiện tiêu đề, mô tả hoặc nội dung có thể đưa lên trang đầu.",
  low_ctr: "Đã ở trang đầu nhưng ít người bấm: thử viết lại tiêu đề và mô tả hấp dẫn hơn.",
};

/** Phần hiển thị thuần của thẻ (tách khỏi việc tải dữ liệu để kiểm thử được). */
export function SearchConsoleSummary({ overview }: { overview: SearchConsoleOverview }) {
  if (overview.connection === "not_configured") {
    return <p className="admin-dashboard__empty">Chưa nối Google Search Console. Nối để thấy khách gõ gì trên Google để tìm website và nên sửa trang nào trước. <Link className="admin-link" href="/admin/search-console">Xem cách nối</Link></p>;
  }
  if (overview.connection === "error") return <p className="admin-dashboard__empty" role="alert">{overview.message} <Link className="admin-link" href="/admin/search-console">Kiểm tra kết nối</Link></p>;
  const { totals, opportunities } = overview;
  return <>
    <p className="admin-dashboard__empty">{numberFormat.format(totals.impressions)} lượt hiện · {numberFormat.format(totals.clicks)} lượt bấm · hạng trung bình {decimalFormat.format(totals.position)} (28 ngày, đến {overview.period.endDate.split("-").reverse().join("/")}).</p>
    {opportunities.length ? <div className="admin-dashboard__list">{opportunities.slice(0, 5).map((item) => <a href={`https://www.google.com/search?q=${encodeURIComponent(item.query)}`} key={`${item.reason}-${item.query}`} rel="noreferrer" target="_blank" title={reasonHints[item.reason]}>
      <i className="admin-status" />
      <span><strong>{item.query}</strong><small>{reasonLabels[item.reason]} · hạng {decimalFormat.format(item.position)} · {numberFormat.format(item.impressions)} lượt hiện · {percentFormat.format(item.ctr)} bấm</small></span>
    </a>)}</div> : <p className="admin-dashboard__empty">Chưa có cụm nào đủ dữ liệu để gợi ý. Google thường cần vài tuần để có số liệu cho website mới.</p>}
  </>;
}

/**
 * Thẻ "Cơ hội trên Google" ở Tổng quan. Tải sau khi trang mở (không làm chậm Tổng quan vì lần đầu phải hỏi Google);
 * người không có quyền xem cài đặt không thấy thẻ.
 */
export function SearchConsoleCard() {
  const [state, setState] = useState<{ status: "loading" } | { status: "hidden" } | { status: "ready"; overview: SearchConsoleOverview }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await requestAdminJson("/api/v1/admin/search-console", "GET", undefined, "Không lấy được số liệu từ Google Search Console lúc này.") as { overview?: SearchConsoleOverview } | null;
        if (cancelled) return;
        setState({ status: "ready", overview: body?.overview ?? { connection: "error", message: "Không lấy được số liệu từ Google Search Console lúc này." } });
      } catch (error) {
        if (cancelled) return;
        // Không có quyền xem cài đặt: ẩn thẻ. Lỗi khác: nêu rõ ngay trong thẻ.
        if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) { setState({ status: "hidden" }); return; }
        setState({ status: "ready", overview: { connection: "error", message: error instanceof AdminApiError ? error.message : "Không kết nối được máy chủ để lấy số liệu Google Search Console." } });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.status === "hidden") return null;
  return <AdminCard>
    <header><div><h2>Cơ hội trên Google</h2><p>Từ khóa khách gõ để thấy website</p></div></header>
    {state.status === "loading" ? <p aria-busy="true" className="admin-dashboard__empty">Đang hỏi Google…</p> : <SearchConsoleSummary overview={state.overview} />}
  </AdminCard>;
}
