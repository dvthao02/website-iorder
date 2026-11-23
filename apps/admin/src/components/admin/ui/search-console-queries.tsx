"use client";

import React, { useEffect, useState } from "react";

import { requestAdminJson } from "../../../lib/admin-api";

import type { SearchConsolePageQueries } from "@iorder/shared/server/search-console/search-console.contract";
import { AdminButton } from "./admin-button";

const numberFormat = new Intl.NumberFormat("vi-VN");
const decimalFormat = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

/** Phần hiển thị thuần (tách khỏi việc tải dữ liệu để kiểm thử được). */
export function SearchConsoleQueriesList({ result, onUse, disabled }: { result: SearchConsolePageQueries; onUse?: (query: string) => void; disabled?: boolean }) {
  if (result.connection === "not_configured") return <p className="admin-help">Chưa nối Google Search Console nên chưa có số liệu.</p>;
  if (result.connection === "error") return <p className="admin-help" role="alert">{result.message}</p>;
  if (!result.queries.length) return <p className="admin-help">Chưa có cụm nào: trang cần được Google đưa lên kết quả và có người thấy (thường vài tuần sau khi đăng).</p>;
  return <ul className="admin-seo__gsc-list">{result.queries.map((item) => <li key={item.query}>
    <span><strong>{item.query}</strong><small>hạng {decimalFormat.format(item.position)} · {numberFormat.format(item.impressions)} lượt hiện · {numberFormat.format(item.clicks)} lượt bấm</small></span>
    {onUse ? <AdminButton disabled={disabled} onClick={() => onUse(item.query)} size="sm" variant="secondary">Dùng làm từ khóa chính</AdminButton> : null}
  </li>)}</ul>;
}

/**
 * "Khách đang tìm gì để thấy trang này": các cụm Google ghi nhận cho đúng trang đang sửa (28 ngày). Hỏi backend một lần khi mở màn sửa
 * (backend nhớ kết quả vài giờ, và khi chưa nối Search Console thì không gọi mạng). Chỉ hiện mục này khi đã nối được: chưa nối hoặc lỗi thì
 * ẩn hẳn để khỏi làm rối người soạn bài (lỗi nối đã hiện ở thẻ "Cơ hội trên Google" ở Tổng quan). Bấm "Dùng làm từ khóa chính" để điền vào ô từ khóa.
 */
export function SearchConsoleQueries({ path, onUse, disabled }: { path: string; onUse?: (query: string) => void; disabled?: boolean }) {
  const [loaded, setLoaded] = useState<{ path: string; result: SearchConsolePageQueries } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    // Lỗi (chưa nối, không có quyền, mất mạng) thì ẩn mục này, không báo gì: xem ghi chú ở trên.
    requestAdminJson(`/api/v1/admin/search-console?path=${encodeURIComponent(path)}`, "GET", undefined, "Không lấy được từ khóa của trang này.")
      .then((body) => { const page = (body as { page?: SearchConsolePageQueries } | null)?.page; if (!cancelled && page) setLoaded({ path, result: page }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [path]);

  if (!loaded || loaded.path !== path || loaded.result.connection !== "connected") return null;
  return <details className="admin-seo__gsc">
    <summary>Khách đang tìm gì để thấy trang này</summary>
    <SearchConsoleQueriesList disabled={disabled} onUse={onUse} result={loaded.result} />
  </details>;
}
