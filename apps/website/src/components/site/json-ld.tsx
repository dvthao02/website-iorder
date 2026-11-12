import { serializeJsonLd } from "@/lib/structured-data";

/** Một hoặc nhiều khối schema.org; không hiển thị gì khi chưa có dữ liệu. */
export function JsonLd({ data }: { data: unknown[] }) {
  const items = data.filter(Boolean);
  if (!items.length) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(items.length === 1 ? items[0] : items) }} />;
}
