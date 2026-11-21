type LinkIntent = {
  href: string;
  currentHref: string;
  target: string;
  download: boolean;
  modified: boolean;
  button: number;
};

// Chỉ bảo vệ link nội bộ rời route; tab mới/download/anchor không bỏ form hiện tại.
export function shouldConfirmNavigation(intent: LinkIntent) {
  if (intent.modified || intent.button !== 0 || intent.download || (intent.target && intent.target.toLowerCase() !== "_self")) return false;
  const current = new URL(intent.currentHref);
  const destination = new URL(intent.href, current);
  return destination.origin === current.origin &&
    (destination.pathname !== current.pathname || destination.search !== current.search);
}

export function shouldConfirmHistoryNavigation(intent: {
  href: string; currentHref: string; navigationType: string; cancelable: boolean;
}) {
  return intent.cancelable && intent.navigationType === "traverse" && shouldConfirmNavigation({
    href: intent.href, currentHref: intent.currentHref,
    target: "", download: false, modified: false, button: 0,
  });
}
