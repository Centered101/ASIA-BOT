const FALLBACK_FILE_NAME = "image";
const MAX_FILE_NAME_LENGTH = 80;
const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export function sanitizeStorageName(name: string) {
  const cleaned = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[/\\?%*:|"<>#\x00-\x1f]/g, "")
    .replace(/^-+|-+$/g, "");

  return cleaned.slice(0, MAX_FILE_NAME_LENGTH) || FALLBACK_FILE_NAME;
}

export function buildTimedImageName(fileName: string, ext: string, time = Date.now()) {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  return `${sanitizeStorageName(baseName)}-${time}.${ext}`;
}

export function getStorageDateFolder(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildStorageImagePath({
  fileName,
  ext,
  folder,
  date,
  time,
}: {
  fileName: string;
  ext: string;
  folder?: string | null;
  date?: Date;
  time?: number;
}) {
  const cleanFolder = folder ? sanitizeStorageName(folder) : null;
  const pathParts = [
    cleanFolder,
    getStorageDateFolder(date),
    buildTimedImageName(fileName, ext, time),
  ].filter(Boolean);

  return pathParts.join("/");
}
