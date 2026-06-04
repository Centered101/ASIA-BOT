// V42
const API_URL = "https://script.google.com/macros/s/AKfycbxHk65tHwlMIye05TW6vGnXT1pXhwQodu5TF1fukMka3mr4ZNvUG-HUyIqQvMbEKI3JAw/exec";
const LS_DATA = "asia_lb_session";
const LS_TIME = "asia_lb_session_time";
const SESSION_TTL = 8 * 60 * 60 * 1000;
const API_SHOP = "https://script.google.com/macros/s/AKfycbyaghGYtQGSgnYcxrZUHKyDBzpBgiZWaFoRkll846qWuBysuoVOZT9GtnKwMVZ4PB-Q/exec";

// ══════════════════════════════════════════════
//  คำนวณระดับชั้น
// ══════════════════════════════════════════════
function calcGrade(program, entryYear) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const thaiYear = now.getFullYear() + 543 - (month < 5 ? 1 : 0);
    const diff = thaiYear - parseInt(entryYear || 0) + 1;
    const maxYr = program === "ปวส" ? 2 : 3;
    if (diff < 1) return `${program} (รอเข้าเรียน)`;
    if (diff > maxYr) return `${program} (จบการศึกษา)`;
    return `${program}${diff}`;
}
