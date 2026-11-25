import { SiteStatusMessage } from "@/components/site/site-status-message";
import { getT } from "@/lib/messages";

// URL không khớp route nào nằm ngoài nhóm (web); vẫn trả trang 404 tiếng Việt thay vì trang mặc định.
export default async function RootNotFound() {
  const t = await getT();
  return <SiteStatusMessage description={t("status.notFound.description")} eyebrow={t("status.notFound.eyebrow")} title={t("status.notFound.title")} />;
}
