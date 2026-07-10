const IMAGE_HOST_SUFFIXES = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]);

export function safeImageSrc(value: string | null | undefined): string | null {
  const src = String(value ?? "").trim();
  if (!src) return null;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  if (src.startsWith("blob:")) return src;
  if (/^data:image\//i.test(src)) return src;

  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const parts = url.hostname.toLowerCase().split(".");
    if (parts.length <= 1) return null;
    if (IMAGE_HOST_SUFFIXES.has(parts.at(-1) ?? "")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isDisplayableImageUrl(value: string | null | undefined): boolean {
  return safeImageSrc(value) !== null;
}
