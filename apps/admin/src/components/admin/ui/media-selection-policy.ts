export function isSelectableMediaType(mimeType: string, documents: boolean): boolean {
  return (documents ? ["application/pdf", "application/zip"] : ["image/png", "image/jpeg", "image/webp"]).includes(mimeType);
}
