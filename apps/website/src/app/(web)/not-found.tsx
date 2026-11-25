import { SiteHeader } from "@/components/site/site-header";
import { SiteStatusMessage } from "@/components/site/site-status-message";
import { getT } from "@/lib/messages";

export default async function PublicNotFound() {
  const t = await getT();
  return <><SiteHeader /><SiteStatusMessage description={t("status.notFound.description")} eyebrow={t("status.notFound.eyebrow")} title={t("status.notFound.title")} /></>;
}
