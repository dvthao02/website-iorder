"use client";

import { useT } from "@/components/site/messages-provider";
import { SiteStatusMessage } from "@/components/site/site-status-message";

export default function PublicError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useT();
  return <SiteStatusMessage description={t("status.error.description")} eyebrow={t("status.error.eyebrow")} kind="error" onRetry={() => retry()} title={t("status.error.title")} />;
}
