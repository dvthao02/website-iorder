const defaultPublicWebsiteOrigin = "http://localhost:3000";

function normalizedOrigin(value: string | undefined) {
  const candidate = value?.trim() || defaultPublicWebsiteOrigin;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : defaultPublicWebsiteOrigin;
  } catch {
    return defaultPublicWebsiteOrigin;
  }
}

/** CMS và website public là hai ứng dụng độc lập. */
export function publishedPublicUrl(path: string, origin = process.env.NEXT_PUBLIC_PUBLISH_WEB_URL) {
  return new URL(path, normalizedOrigin(origin)).toString();
}
