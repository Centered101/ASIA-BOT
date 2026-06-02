export type AmenityInfo = {
  icon: string;
  label: string;
};

export const AMENITY_ICONS: Record<string, AmenityInfo> = {
  projector: { icon: "fa-solid fa-video", label: "โปรเจกเตอร์" },
  whiteboard: { icon: "fa-solid fa-chalkboard", label: "ไวท์บอร์ด" },
  ac: { icon: "fa-solid fa-snowflake", label: "แอร์" },
  wifi: { icon: "fa-solid fa-wifi", label: "WiFi" },
  computer: { icon: "fa-solid fa-desktop", label: "คอมพิวเตอร์" },
  tv: { icon: "fa-solid fa-tv", label: "โทรทัศน์" },
  mic: { icon: "fa-solid fa-microphone", label: "ไมโครโฟน" },
  camera: { icon: "fa-solid fa-camera", label: "กล้อง" },

  drawingTablet: { icon: "fa-solid fa-pen-ruler", label: "เมาส์ปากกา" },
  graphicMonitor: { icon: "fa-solid fa-display", label: "จอกราฟิก" },
  colorPrinter: { icon: "fa-solid fa-print", label: "เครื่องพิมพ์สี" },
  scanner: { icon: "fa-solid fa-file-image", label: "สแกนเนอร์" },
  speaker: { icon: "fa-solid fa-volume-high", label: "ลำโพง" },
  headphones: { icon: "fa-solid fa-headphones", label: "หูฟัง" },
  greenScreen: { icon: "fa-solid fa-square", label: "Green Screen" },
  studioLight: { icon: "fa-solid fa-lightbulb", label: "ไฟสตูดิโอ" },
  spotlight: { icon: "fa-solid fa-sun", label: "สปอตไลท์" },
  nas: { icon: "fa-solid fa-hard-drive", label: "NAS Server" },
  lan: { icon: "fa-solid fa-network-wired", label: "LAN" },
  ups: { icon: "fa-solid fa-battery-full", label: "UPS" },

  photoshop: { icon: "fa-solid fa-palette", label: "Adobe Photoshop" },
  illustrator: { icon: "fa-solid fa-pen-nib", label: "Adobe Illustrator" },
  premiere: { icon: "fa-solid fa-film", label: "Adobe Premiere Pro" },
  blender: { icon: "fa-solid fa-cube", label: "Blender" },

  teacherDesk: { icon: "fa-solid fa-user-tie", label: "โต๊ะผู้สอน" },
  studentDesk: { icon: "fa-solid fa-users", label: "โต๊ะนักเรียน" },
  meetingTable: { icon: "fa-solid fa-table", label: "โต๊ะประชุม" },

  keyLight: { icon: "fa-solid fa-lightbulb", label: "Key Light" },
  fillLight: { icon: "fa-solid fa-lightbulb", label: "Fill Light" },
  backLight: { icon: "fa-solid fa-lightbulb", label: "Back Light" },
  softbox: { icon: "fa-solid fa-box", label: "Softbox" },
  ringLight: { icon: "fa-regular fa-circle", label: "Ring Light" },
  lightStand: { icon: "fa-solid fa-up-right-and-down-left-from-center", label: "ขาตั้งไฟ" },
  teleprompter: { icon: "fa-solid fa-scroll", label: "Teleprompter" },
  audioMixer: { icon: "fa-solid fa-sliders", label: "Audio Mixer" },
  videoSwitcher: { icon: "fa-solid fa-arrows-turn-to-dots", label: "Video Switcher" },
};

export const AMENITY_OPTIONS = Object.entries(AMENITY_ICONS).map(([value, info]) => ({
  value,
  ...info,
}));

const ALIASES: Record<string, string> = {
  "โปรเจกเตอร์": "projector",
  "โปรเจคเตอร์": "projector",
  "ไวท์บอร์ด": "whiteboard",
  "แอร์": "ac",
  "คอมพิวเตอร์": "computer",
  "โทรทัศน์": "tv",
  "ไมโครโฟน": "mic",
  "กล้อง": "camera",
  "เมาส์ปากกา": "drawingTablet",
  "จอกราฟิก": "graphicMonitor",
  "เครื่องพิมพ์สี": "colorPrinter",
  "สแกนเนอร์": "scanner",
  "ลำโพง": "speaker",
  "หูฟัง": "headphones",
  "กรีนสกรีน": "greenScreen",
  "ไฟสตูดิโอ": "studioLight",
  "สปอตไลท์": "spotlight",
  "NAS Server": "nas",
  "Adobe Photoshop": "photoshop",
  "Adobe Illustrator": "illustrator",
  "Adobe Premiere Pro": "premiere",
  "โต๊ะผู้สอน": "teacherDesk",
  "โต๊ะนักเรียน": "studentDesk",
  "โต๊ะประชุม": "meetingTable",
  "ขาตั้งไฟ": "lightStand",
};

function normalizeAmenity(value: string) {
  return value.trim().replace(/[\s_-]+/g, "").toLowerCase();
}

const NORMALIZED_KEYS = Object.fromEntries(
  Object.keys(AMENITY_ICONS).map((key) => [normalizeAmenity(key), key]),
);

export function getAmenityInfo(value: string): AmenityInfo {
  const raw = value.trim();
  const aliasKey = ALIASES[raw];
  const normalizedKey = NORMALIZED_KEYS[normalizeAmenity(raw)];
  const key = aliasKey ?? normalizedKey;

  return key && AMENITY_ICONS[key]
    ? AMENITY_ICONS[key]
    : { icon: "fa-solid fa-circle-check", label: raw || "ไม่ระบุ" };
}
