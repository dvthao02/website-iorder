"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

import { FacebookIcon } from "./brand-icons";
import { useT } from "./messages-provider";

/** Chia sẻ bài viết: mở hộp chia sẻ Facebook với đường dẫn trang hiện tại, hoặc sao chép liên kết. */
export function ShareLinks() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const shareFacebook = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, "_blank", "noopener,noreferrer,width=640,height=560");
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return <div aria-label={t("article.shareGroup")} className="share-links" role="group">
    <span className="share-links__label">{t("article.share")}</span>
    <button className="share-links__button" onClick={shareFacebook} type="button"><FacebookIcon size={18} />Facebook</button>
    <button aria-live="polite" className="share-links__button" onClick={() => void copy()} type="button">{copied ? <Check aria-hidden="true" size={17} /> : <Link2 aria-hidden="true" size={17} />}{copied ? t("article.copied") : t("article.copyLink")}</button>
  </div>;
}
