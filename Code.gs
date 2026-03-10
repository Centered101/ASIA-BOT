// ═══════════════════════════════════════════════════════════════════════
//  ASIA-LB — Student Registration Apps Script  v3.0
//  ผู้พัฒนา: Centered101
//  อัปเดต : 2025
// ═══════════════════════════════════════════════════════════════════════

// ── ค่าคงที่ทั่วไป ───────────────────────────────────────────────────────
const SHEET_NAME = "Students";
const LOG_SHEET_NAME = "Login_Logs";
const NOTIFY_EMAIL = ""; // ใส่ email เพื่อรับแจ้งเตือนสมัครใหม่
const DATA_START = 3; // แถวข้อมูลเริ่มต้น (แถว 1=header, 2=legend)

// ── นิยาม column ของตาราง Students ──────────────────────────────────────
// tier 0=auto, 1=ต้องมี, 2=ควรมี, 3=ติดต่อ, 4=ระบบ
const COLUMNS = [
  { key: "timestamp", label: "⏱ บันทึกเมื่อ", tier: 0, width: 155, def: null },
  { key: "student_id", label: "รหัสนักเรียน", tier: 1, width: 125, def: "" },
  { key: "student_phone", label: "เบอร์โทร", tier: 1, width: 115, def: "" },
  { key: "first_name", label: "ชื่อ", tier: 1, width: 115, def: "" },
  { key: "last_name", label: "นามสกุล", tier: 1, width: 140, def: "" },
  { key: "program", label: "ระดับ", tier: 1, width: 75, def: "" },
  { key: "entry_year", label: "ปีที่เข้าเรียน", tier: 1, width: 120, def: "" },
  { key: "nickname", label: "ชื่อเล่น", tier: 2, width: 95, def: "" },
  { key: "department", label: "สาขาวิชา", tier: 2, width: 155, def: "" },
  { key: "parent_name", label: "ผู้ปกครอง", tier: 3, width: 155, def: "" },
  { key: "parent_phone", label: "เบอร์โทร", tier: 3, width: 115, def: "" },
  { key: "parent_line", label: "LINE ID", tier: 3, width: 135, def: "" },
  { key: "uid", label: "uid", tier: 4, width: 195, def: null },
  {
    key: "card_status",
    label: "card_status",
    tier: 4,
    width: 115,
    def: "inactive",
  },
  {
    key: "student_status",
    label: "student_status",
    tier: 4,
    width: 125,
    def: "active",
  },
];

// ── นิยาม column ของตาราง Login_Logs ────────────────────────────────────
const LOG_COLUMNS = [
  { key: "log_time", label: "⏱ เวลา", width: 160 },
  { key: "student_id_attempt", label: "รหัสที่พิมพ์", width: 130 },
  { key: "status", label: "ผลลัพธ์", width: 90 },
  { key: "reason", label: "เหตุผล", width: 200 },
  { key: "ip_address", label: "IP Address", width: 140 },
  { key: "user_agent", label: "User Agent", width: 320 },
  { key: "platform", label: "Platform", width: 110 },
  { key: "language", label: "Language", width: 90 },
  { key: "screen", label: "Screen", width: 100 },
  { key: "color_depth", label: "Color Depth", width: 90 },
  { key: "timezone", label: "Timezone", width: 160 },
  { key: "referrer", label: "Referrer", width: 200 },
  { key: "page_url", label: "Page URL", width: 220 },
  { key: "touch_device", label: "Touch", width: 70 },
];

// ── นิยาม column ของตาราง Attendance ────────────────────────────────────
const ATTEND_COLUMNS = [
  { key: "checkin_time", label: "⬇ เช็คอิน", width: 160 },
  { key: "checkout_time", label: "⬆ เช็คเอาท์", width: 160 },
  { key: "duration", label: "⏱ ใช้เวลา", width: 100 },
  { key: "student_id", label: "รหัสนักเรียน", width: 125 },
  { key: "name", label: "ชื่อ-นามสกุล", width: 190 },
  { key: "nickname", label: "ชื่อเล่น", width: 90 },
  { key: "program", label: "ระดับ", width: 75 },
  { key: "department", label: "สาขาวิชา", width: 155 },
  { key: "uid", label: "UID บัตร", width: 165 },
];

// ── index ย่อสำหรับ ATTEND_COLUMNS ──────────────────────────────────────
const AI_CHECKIN = ATTEND_COLUMNS.findIndex((c) => c.key === "checkin_time");
const AI_CHECKOUT = ATTEND_COLUMNS.findIndex((c) => c.key === "checkout_time");
const AI_DURATION = ATTEND_COLUMNS.findIndex((c) => c.key === "duration");
const AI_UID = ATTEND_COLUMNS.findIndex((c) => c.key === "uid");

// ── ชื่อ Sheet ของแต่ละจุดเช็คชื่อ ─────────────────────────────────────
const ATTEND_SHEETS = {
  school: "เช็คชื่อ_โรงเรียน",
  library: "เช็คชื่อ_ห้องสมุด",
  meeting: "เช็คชื่อ_ห้องประชุม",
};

// ── ตั้งค่า Daily Reset ──────────────────────────────────────────────
const RESET_HOUR = 0; // รีเซตตอน 00:xx น. (Bangkok time)
const ARCHIVE_SHEET_PREFIX = "Archive_"; // prefix ชื่อ sheet เก็บประวัติ

// ── สีพื้นหลัง header ตาม tier ─────────────────────────────────────────
const TIER_BG = {
  0: "#F1F5F9",
  1: "#FECACA",
  2: "#FEF9C3",
  3: "#DCFCE7",
  4: "#DBEAFE",
};

// ── field ที่บังคับต้องกรอก (tier 1) ────────────────────────────────────
const REQUIRED = COLUMNS.filter((c) => c.tier === 1).map((c) => c.key);

// ── LINE Bot config ─────────────────────────────────────────────────────
const LINE_TOKEN =
  "UFC+xybfw1MEbczn3apaEPX/Z0TgmTIP44OwEfFMJ0UfPrU+eVD9U0JheI3XQglPguD6rWnPGMpDMi2iJ8LlnYuRRl28Wf+f4O2wk2WCU6U9IdrOIBGZv9rgQN0d93n9SQWFvPbxKfdk0nChsqqRsAdB04t89/1O/w1cDnyilFU=";
const LINE_USER = "U493e8a5daf658c223c825c028c5247f6";
const LINE_GROUP = "Cxxxxxxxxxxxxxxxx";

// ═══════════════════════════════════════════════════════════════════════
//  HTTP HANDLERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * doPost — รับ 2 กรณี:
 *   1) ลงทะเบียนนักเรียนใหม่ (form params)
 *   2) แจ้งเตือน LINE จาก webhook (JSON body)
 */
function doPost(e) {
  try {
    if (e.postData && e.postData.contents) {
      let parsed;
      try {
        parsed = JSON.parse(e.postData.contents);
      } catch (_) {
        parsed = null;
      }

      // ถ้าเป็น LINE webhook จริง (มี name/uid/status)
      if (parsed && parsed.uid) {
        const msg = `แจ้งเตือนระบบบัตรนักเรียน\nชื่อ: ${parsed.name}\nUID: ${parsed.uid}\nสถานะ: ${parsed.status}`;
        sendLine(msg);
        return res({ status: "ok", message: "LINE sent" }, cb); // ✅ คืน JSON เสมอ
      }
    }

    // ✅ ถ้าไม่มี JSON body → ลงทะเบียนนักเรียน (form params)
    const p = e.parameter;
    const sheet = getOrCreateSheet();

    const missing = REQUIRED.filter((k) => !p[k] || !p[k].trim());
    if (missing.length)
      return res(
        { status: "error", message: "กรอกข้อมูลหลักไม่ครบ", missing },
        cb,
      );

    if (isDuplicate(sheet, p.student_id.trim()))
      return res(
        { status: "duplicate", message: "รหัสนักเรียนนี้ถูกลงทะเบียนแล้ว" },
        cb,
      );

    const now = now_bkk();
    const uid = generateUID(p.student_id.trim());

    const row = COLUMNS.map((col) => {
      if (col.key === "timestamp") return now;
      if (col.key === "uid") return uid;
      if (col.def && !p[col.key]?.trim()) return col.def;
      return p[col.key]?.trim() || "";
    });

    sheet.appendRow(row);
    styleDataRow(sheet, sheet.getLastRow());

    if (NOTIFY_EMAIL) notifyEmail(p, uid, now);
    return res({ status: "success", message: "ลงทะเบียนสำเร็จ", uid }, cb);
  } catch (err) {
    // ✅ catch เดียว ครอบทั้ง 2 กรณี
    console.error(err);
    return res({ status: "error", message: err.message }, cb);
  }
} // ✅ ปิด function ครั้งเดียว

/**
 * doGet — เส้นทาง API ทั้งหมด (ผ่าน ?action=xxx)
 *   list           → ดึงนักเรียนทั้งหมด
 *   check          → เช็คว่า student_id มีในระบบหรือยัง
 *   get            → ดึงข้อมูลนักเรียน 1 คน
 *   login          → ยืนยัน student_id + เบอร์โทร
 *   log_login      → บันทึก login attempt พร้อม device info
 *   update         → แก้ไขข้อมูลนักเรียน
 *   rfid_checkin   → ESP32 แตะบัตร toggle เช็คอิน/เอาท์
 *   get_student_uid→ ดึง uid เพื่อเขียนลงบัตร
 *   assign_uid     → เปิดใช้บัตร (card_status → active)
 *   clear_card_uid → รีเซ็ตบัตร (card_status → inactive)
 *   attendance     → ดูประวัติเช็คชื่อ
 */
function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  // ── JSONP support: jQuery ส่ง ?callback=jQuery_xxx มาอัตโนมัติ ──
  const cb = e.parameter.callback || null;
  const sheet = getOrCreateSheet();

  switch (action) {
    case "list":
      return actionList(sheet, cb);
    case "check":
      return actionCheck(sheet, e, cb);
    case "get":
      return actionGet(sheet, e, cb);
    case "login":
      return actionLogin(sheet, e, cb);
    case "log_login":
      return actionLogLogin(e, cb);
    case "update":
      return actionUpdate(sheet, e, cb);
    case "rfid_checkin":
      return handleRFIDCheckin(e, cb);
    case "get_student_uid":
      return handleGetStudentUID(e, cb);
    case "assign_uid":
      return handleAssignUID(e, cb);
    case "clear_card_uid":
      return handleClearCardUID(e, cb);
    case "get_all_uids":
      return handleGetAllUIDs(e, cb);
    case "attendance":
      return handleAttendance(e, cb);
    // ── Shop endpoints ─────────────────────────────────────────
    case "get_products":
      return handleGetProducts(e, cb);
    case "create_order":
      return handleCreateOrder(e, cb);
    case "check_payment":
      return handleCheckPayment(e, cb);
    case "confirm_payment":
      return handleConfirmPayment(e, cb);
    case "get_orders":
      return handleGetOrders(e, cb);
    case "update_stock":
      return handleUpdateStock(e, cb);
    case "admin_orders":
      return handleAdminOrdersPage(e);
    default:
      return res(
        { status: "ok", message: "Centered101 API v3.0 🚀 แล้วครับบบผมม" },
        cb,
      );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ACTION HANDLERS (doGet)
// ═══════════════════════════════════════════════════════════════════════

/** ?action=list — คืนข้อมูลนักเรียนทั้งหมด */
function actionList(sheet, cb) {
  return res({ status: "success", data: getAllRows(sheet) }, cb);
}

/** ?action=check&student_id=xxx — ตรวจว่า student_id ซ้ำหรือไม่ */
function actionCheck(sheet, e, cb) {
  const id = (e.parameter.student_id || "").trim();
  return res({ status: "success", exists: isDuplicate(sheet, id) }, cb);
}

/** ?action=get&student_id=xxx — ดึงข้อมูลนักเรียน 1 คน */
function actionGet(sheet, e, cb) {
  const id = (e.parameter.student_id || "").trim();
  const row = findByStudentId(sheet, id);
  return row
    ? res({ status: "success", data: row })
    : res({ status: "notfound", message: "ไม่พบรหัสนักเรียนนี้" });
}

/**
 * ?action=login&student_id=xxx&student_phone=xxx
 * ยืนยันตัวตน: เช็ครหัส + เบอร์โทร + สถานะบัญชี
 * คืนข้อมูลโดยซ่อน student_phone
 */
function actionLogin(sheet, e, cb) {
  const id = (e.parameter.student_id || "").trim();
  const phone = (e.parameter.student_phone || "").trim();

  if (!id || !phone)
    return res(
      { status: "error", message: "กรุณากรอกรหัสนักเรียนและเบอร์โทร" },
      cb,
    );

  const row = findByStudentId(sheet, id);
  if (!row)
    return res({ status: "error", message: "ไม่พบรหัสนักเรียนนี้ในระบบ" }, cb);

  // normalize เบอร์: ตัด 0 นำหน้า (Sheets อาจเก็บเป็น number)
  const trim0 = (p) =>
    String(p || "")
      .trim()
      .replace(/^0+/, "");
  const stored = trim0(row["student_phone"]);
  const input = trim0(phone);
  if (!stored || stored !== input)
    return res({ status: "error", message: "เบอร์โทรไม่ถูกต้อง" }, cb);

  if (row["student_status"] && row["student_status"] !== "active")
    return res({ status: "error", message: "บัญชีนี้ถูกระงับการใช้งาน" }, cb);

  const safeData = { ...row };
  delete safeData["student_phone"]; // ไม่ส่ง password กลับ
  return res(
    { status: "success", message: "เข้าสู่ระบบสำเร็จ", data: safeData },
    cb,
  );
}

/**
 * ?action=log_login — บันทึกทุก login attempt พร้อม device fingerprint
 * params: student_id_attempt, status, reason, user_agent, platform,
 *         language, screen, color_depth, timezone, referrer, page_url, touch_device
 */
function actionLogLogin(e, cb) {
  try {
    const logSheet = getOrCreateLogSheet();
    const logRow = LOG_COLUMNS.map((col) => {
      if (col.key === "log_time") return now_bkk();
      if (col.key === "ip_address") return "N/A (client)"; // Apps Script ไม่เปิด IP ผู้เรียก
      const val = e.parameter[col.key];
      return val != null ? String(val).trim() : "";
    });

    logSheet.appendRow(logRow);
    styleLogRow(
      logSheet,
      logSheet.getLastRow(),
      e.parameter.status || "unknown",
    );
    return res(
      {
        status: "ok",
        message: "logged",
        id_attempt: e.parameter.student_id_attempt || "",
      },
      cb,
    );
  } catch (err) {
    console.error("log_login error:", err);
    return res({ status: "error", message: err.message }, cb);
  }
}

/**
 * ?action=update&student_id=xxx&[field]=value
 * แก้ไขข้อมูลที่อนุญาต: ชื่อ, นามสกุล, ชื่อเล่น, สาขา, เบอร์, ผู้ปกครอง
 */
function actionUpdate(sheet, e, cb) {
  const id = (e.parameter.student_id || "").trim();
  if (!id) return res({ status: "error", message: "ไม่มี student_id" }, cb);

  const rowIdx = findRowIndex(sheet, id);
  if (!rowIdx)
    return res({ status: "notfound", message: "ไม่พบรหัสนักเรียน" }, cb);

  const updatable = [
    "first_name",
    "last_name",
    "nickname",
    "department",
    "student_phone",
    "parent_name",
    "parent_phone",
    "parent_line",
  ];

  updatable.forEach((key) => {
    if (e.parameter[key] === undefined) return;
    const colIdx = COLUMNS.findIndex((c) => c.key === key) + 1;
    if (colIdx > 0)
      sheet.getRange(rowIdx, colIdx).setValue(e.parameter[key].trim());
  });

  return res({ status: "success", message: "อัปเดตข้อมูลสำเร็จ" }, cb);
}

// ═══════════════════════════════════════════════════════════════════════
//  RFID HANDLERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * ?action=get_student_uid&student_id=xxx
 * ESP32 เรียกก่อนเขียนบัตร → คืน uid ของนักเรียน
 */
function handleGetStudentUID(e, cb) {
  const studentId = (e.parameter.student_id || "").trim();
  if (!studentId)
    return res({ status: "error", message: "ไม่มี student_id" }, cb);

  const student = findByStudentId(getOrCreateSheet(), studentId);
  if (!student)
    return res(
      { status: "notfound", message: "ไม่พบรหัสนักเรียน " + studentId },
      cb,
    );

  const uid = (student.uid || "").toString().trim();
  if (!uid)
    return res({ status: "error", message: "นักเรียนยังไม่มี uid ในระบบ" }, cb);

  const name = `${student.first_name} ${student.last_name}`.trim();
  return res({ status: "success", uid, name, student_id: studentId }, cb);
}

/**
 * ?action=assign_uid&student_id=xxx&uid=xxx
 * เปิดใช้บัตร: ตรวจ uid ไม่ชน → set card_status = "active"
 */
function handleAssignUID(e, cb) {
  const studentId = (e.parameter.student_id || "").trim();
  const uid = (e.parameter.uid || "").trim().toUpperCase();
  if (!studentId)
    return res({ status: "error", message: "ไม่มี student_id" }, cb);
  if (!uid) return res({ status: "error", message: "ไม่มี uid" }, cb);

  const sheet = getOrCreateSheet();
  const rowIdx = findRowIndex(sheet, studentId);
  if (!rowIdx)
    return res({ status: "notfound", message: "ไม่พบรหัสนักเรียน" }, cb);

  // ตรวจว่า uid ถูกใช้โดยคนอื่นหรือไม่
  const existing = findByUID(sheet, uid);
  if (existing && existing.student_id.toString() !== studentId)
    return res(
      {
        status: "error",
        message: `UID นี้ผูกกับรหัส ${existing.student_id} แล้ว`,
      },
      cb,
    );

  const statusCol = COLUMNS.findIndex((c) => c.key === "card_status") + 1;
  sheet.getRange(rowIdx, statusCol).setValue("active");
  return res(
    {
      status: "success",
      message: "card_status = active",
      student_id: studentId,
      uid,
    },
    cb,
  );
}

/**
 * ?action=clear_card_uid&uid=xxx
 * รีเซ็ตบัตร: set card_status = "inactive"
 */
function handleClearCardUID(e, cb) {
  const uid = (e.parameter.uid || "").trim().toUpperCase();
  if (!uid) return res({ status: "error", message: "ไม่มี uid" }, cb);

  const sheet = getOrCreateSheet();
  const student = findByUID(sheet, uid);
  if (!student)
    return res({ status: "notfound", message: "UID ไม่พบในระบบ" }, cb);

  const rowIdx = findRowIndex(sheet, student.student_id.toString());
  const statusCol = COLUMNS.findIndex((c) => c.key === "card_status") + 1;
  sheet.getRange(rowIdx, statusCol).setValue("inactive");

  return res(
    {
      status: "success",
      message: `card_status = inactive สำหรับ ${student.student_id}`,
      student_id: student.student_id,
    },
    cb,
  );
}

/**
 * ?action=get_all_uids
 * คืนรายการบัตรที่ card_status = "active" ทั้งหมด
 * ESP32 โหลดเข้า RAM cache ตอนบูต และกด Reload
 */
function handleGetAllUIDs() {
  const sheet = getOrCreateSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START)
    return res({ status: "success", count: 0, data: [] }, cb);

  const all = sheet
    .getRange(DATA_START, 1, lastRow - DATA_START + 1, COLUMNS.length)
    .getValues();

  const uidIdx = COLUMNS.findIndex((c) => c.key === "uid");
  const cardStatusIdx = COLUMNS.findIndex((c) => c.key === "card_status");
  const firstNameIdx = COLUMNS.findIndex((c) => c.key === "first_name");
  const lastNameIdx = COLUMNS.findIndex((c) => c.key === "last_name");
  const nicknameIdx = COLUMNS.findIndex((c) => c.key === "nickname");
  const sidIdx = COLUMNS.findIndex((c) => c.key === "student_id");
  const programIdx = COLUMNS.findIndex((c) => c.key === "program");
  const deptIdx = COLUMNS.findIndex((c) => c.key === "department");

  const result = [];
  for (const row of all) {
    const uid = (row[uidIdx] || "").toString().trim().toUpperCase();
    const cardStatus = (row[cardStatusIdx] || "")
      .toString()
      .trim()
      .toLowerCase();
    if (!uid || cardStatus !== "active") continue;

    const fn = (row[firstNameIdx] || "").toString().trim();
    const ln = (row[lastNameIdx] || "").toString().trim();
    result.push({
      uid: uid,
      student_id: (row[sidIdx] || "").toString().trim(),
      name: (fn + " " + ln).trim(),
      nickname: (row[nicknameIdx] || "").toString().trim(),
      program: (row[programIdx] || "").toString().trim(),
      department: (row[deptIdx] || "").toString().trim(),
    });
  }
  return res({ status: "success", count: result.length, data: result }, cb);
}

/**
 * ?action=rfid_checkin&uid=xxx&location=school|library|meeting
 * ESP32 แตะบัตร → toggle เช็คอิน/เช็คเอาท์อัตโนมัติ
 *   - ถ้ายังไม่มี open session → บันทึกเช็คอิน (append row ใหม่)
 *   - ถ้ามี open session → บันทึกเช็คเอาท์ + คำนวณ duration
 */
function handleRFIDCheckin(e, cb) {
  const uid = (e.parameter.uid || "").trim().toUpperCase();
  const location = (e.parameter.location || "").trim().toLowerCase();

  if (!uid) return res({ status: "error", message: "ไม่มี uid" }, cb);
  if (!ATTEND_SHEETS[location])
    return res(
      { status: "error", message: "location ผิด: school|library|meeting" },
      cb,
    );

  const student = findByUID(getOrCreateSheet(), uid);
  if (!student)
    return res({ status: "notfound", message: "UID ไม่พบในระบบ", uid }, cb);

  const now = now_bkk();
  const name = `${student.first_name} ${student.last_name}`.trim();
  const aSheet = getOrCreateAttendSheet(location);

  const { row: openRow, rowNum } = findOpenCheckin(aSheet, uid);

  if (openRow) {
    // ── เช็คเอาท์ ─────────────────────────────────────────────────
    aSheet.getRange(rowNum, AI_CHECKOUT + 1).setValue(now);
    const duration = calcDuration(openRow[AI_CHECKIN].toString(), now);
    aSheet.getRange(rowNum, AI_DURATION + 1).setValue(duration);
    styleCheckedOut(aSheet, rowNum);

    return res(
      {
        status: "success",
        action: "checkout",
        message: "เช็คเอาท์สำเร็จ",
        name,
        nickname: student.nickname || "",
        student_id: student.student_id,
        location,
        time: now,
        duration,
      },
      cb,
      cb,
    );
  } else {
    // ── เช็คอิน ───────────────────────────────────────────────────
    const row = ATTEND_COLUMNS.map((col) => {
      switch (col.key) {
        case "checkin_time":
          return now;
        case "checkout_time":
          return "";
        case "duration":
          return "";
        case "uid":
          return uid;
        case "student_id":
          return student.student_id;
        case "name":
          return name;
        case "nickname":
          return student.nickname || "";
        case "program":
          return student.program || "";
        case "department":
          return student.department || "";
        default:
          return "";
      }
    });
    aSheet.appendRow(row);
    styleCheckinRow(aSheet, aSheet.getLastRow(), student.program);

    return res(
      {
        status: "success",
        action: "checkin",
        message: "เช็คอินสำเร็จ",
        name,
        nickname: student.nickname || "",
        student_id: student.student_id,
        location,
        time: now,
      },
      cb,
      cb,
    );
  }
}

/**
 * ?action=attendance&location=xxx[&date=dd/MM/yyyy]
 * ดึงประวัติเช็คชื่อของ location นั้น กรองตาม date (optional)
 */
function handleAttendance(e, cb) {
  const location = (e.parameter.location || "").trim().toLowerCase();
  const date = (e.parameter.date || "").trim();
  if (!ATTEND_SHEETS[location])
    return res({ status: "error", message: "location ผิด" }, cb);

  const aSheet = getOrCreateAttendSheet(location);
  const lastRow = aSheet.getLastRow();
  if (lastRow < 2) return res({ status: "success", count: 0, data: [] }, cb);

  let data = aSheet
    .getRange(2, 1, lastRow - 1, ATTEND_COLUMNS.length)
    .getValues()
    .map((r) =>
      Object.fromEntries(ATTEND_COLUMNS.map((c, i) => [c.key, r[i]])),
    );

  if (date) data = data.filter((r) => String(r.checkin_time).startsWith(date));
  return res({ status: "success", count: data.length, data }, cb);
}

// ═══════════════════════════════════════════════════════════════════════
//  DAILY RESET
// ═══════════════════════════════════════════════════════════════════════

/**
 * 
 * 
  — เรียกครั้งเดียวด้วยมือเพื่อสร้าง time-based trigger
 * วิธีใช้: Apps Script Editor → เลือก setupDailyResetTrigger → กด Run
 *
 * trigger จะเรียก dailyResetAttendance ทุกวัน เวลา RESET_HOUR น. (Bangkok)
 * ลบ trigger เก่าชื่อเดียวกันก่อนสร้างใหม่ เพื่อป้องกัน trigger ซ้ำ
 */
function setupDailyResetTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "dailyResetAttendance")
    .forEach((t) => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("dailyResetAttendance")
    .timeBased()
    .everyDays(1)
    .atHour(RESET_HOUR)
    .inTimezone("Asia/Bangkok")
    .create();

  console.log(
    `✅ Trigger ตั้งค่าแล้ว: dailyResetAttendance ทุกวัน ${RESET_HOUR}:00 น. (Bangkok)`,
  );
}

/**
 * removeDailyResetTrigger — ลบ trigger ออก (หยุด auto-reset)
 * วิธีใช้: Apps Script Editor → เลือก removeDailyResetTrigger → กด Run
 */
function removeDailyResetTrigger() {
  const removed = ScriptApp.getProjectTriggers().filter(
    (t) => t.getHandlerFunction() === "dailyResetAttendance",
  );
  removed.forEach((t) => ScriptApp.deleteTrigger(t));
  console.log(`🗑 ลบ trigger แล้ว ${removed.length} รายการ`);
}

/**
 * dailyResetAttendance — ฟังก์ชันที่ trigger เรียกทุกวัน
 * ขั้นตอน:
 *   1) Archive — คัดลอก sheet เช็คชื่อวันนี้ → sheet ใหม่ "Archive_YYYY-MM-DD_location"
 *   2) Reset   — ลบข้อมูลทั้งหมด (เก็บแค่ header แถวที่ 1)
 *   3) Log     — บันทึกผลลง Login_Logs เพื่อ audit trail
 */
function dailyResetAttendance() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dateStr = Utilities.formatDate(
    new Date(),
    "Asia/Bangkok",
    "yyyy-MM-dd",
  );
  const results = [];

  Object.entries(ATTEND_SHEETS).forEach(([location, sheetName]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      results.push(`⚠ ไม่พบ sheet: ${sheetName}`);
      return;
    }

    const lastRow = sheet.getLastRow();
    const rowCount = lastRow - 1; // ไม่นับ header

    // 1) Archive (เฉพาะเมื่อมีข้อมูล)
    if (rowCount > 0) {
      const archiveName = `${ARCHIVE_SHEET_PREFIX}${dateStr}_${location}`;
      const old = ss.getSheetByName(archiveName);
      if (old) ss.deleteSheet(old); // ลบซ้ำ กรณี trigger ทำงาน 2 ครั้ง

      const archived = sheet.copyTo(ss);
      archived.setName(archiveName);
      ss.moveActiveSheet(ss.getNumSheets()); // ย้าย archive ไปแท็บท้ายสุด
      ss.setActiveSheet(sheet);

      results.push(
        `✅ ${sheetName}: archive ${rowCount} แถว → "${archiveName}"`,
      );
    } else {
      results.push(`➖ ${sheetName}: ว่าง ข้ามการ archive`);
    }

    // 2) Reset: ลบแถวข้อมูลทั้งหมด (เหลือแค่ header)
    if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
  });

  // 3) Log ผลลัพธ์
  const summary = results.join(" | ");
  console.log(`[dailyReset] ${dateStr} — ${summary}`);
  logSystemEvent("daily_reset", summary);
}

/**
 * logSystemEvent — บันทึก event ของระบบลง Login_Logs
 * ใช้แทนการ log ด้วยมือ เพื่อให้ audit trail ครบ
 */
function logSystemEvent(eventType, detail) {
  try {
    const logSheet = getOrCreateLogSheet();
    const row = LOG_COLUMNS.map((col) => {
      if (col.key === "log_time") return now_bkk();
      if (col.key === "student_id_attempt") return `[SYSTEM:${eventType}]`;
      if (col.key === "status") return "system";
      if (col.key === "reason") return detail;
      return "";
    });
    logSheet.appendRow(row);
    styleLogRow(logSheet, logSheet.getLastRow(), "system");
  } catch (err) {
    console.error("logSystemEvent error:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  SHEET SETUP
// ═══════════════════════════════════════════════════════════════════════

/** สร้างหรือเปิด sheet Students */
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    initSheet(sheet);
  }
  return sheet;
}

/** สร้างหรือเปิด sheet Login_Logs */
function getOrCreateLogSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ls = ss.getSheetByName(LOG_SHEET_NAME);
  if (!ls) {
    ls = ss.insertSheet(LOG_SHEET_NAME);
    initLogSheet(ls);
  }
  return ls;
}

/** สร้างหรือเปิด sheet เช็คชื่อ ตาม location */
function getOrCreateAttendSheet(location) {
  const name = ATTEND_SHEETS[location];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    initAttendSheet(sheet, location);
  }
  return sheet;
}

/** ตั้งค่า header + legend + format เริ่มต้น ของ sheet Students */
function initSheet(sheet) {
  // แถว 1: header
  sheet.appendRow(COLUMNS.map((c) => c.label));
  COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground(TIER_BG[col.tier])
      .setFontWeight("bold")
      .setFontColor("#1E293B")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });

  sheet
    .getRange(1, 1)
    .setNote(
      "สี header บอก tier:\n" +
        "🔴 แดง   = tier 1 ตัวตนหลัก (ต้องมี)\n" +
        "🟡 เหลือง = tier 2 ใช้งานจริง (ควรมี)\n" +
        "🟢 เขียว = tier 3 ติดต่อ (มีไว้ก่อน)\n" +
        "🔵 ฟ้า   = tier 4 ระบบ — ห้ามลบ/แก้มือ\n" +
        "⬜ เทา   = timestamp (auto)",
    );

  // แถว 2: legend tier
  const legend = COLUMNS.map(
    (col) =>
      ["auto", "★ ต้องมี", "◎ ควรมี", "○ มีไว้ก่อน", "⚙ ระบบ"][col.tier] || "",
  );
  sheet.appendRow(legend);
  sheet
    .getRange(2, 1, 1, COLUMNS.length)
    .setFontColor("#9CA3AF")
    .setFontStyle("italic")
    .setFontSize(9)
    .setHorizontalAlignment("center");
  COLUMNS.forEach((col, i) =>
    sheet.getRange(2, i + 1).setBackground(TIER_BG[col.tier] + "88"),
  );

  sheet.setFrozenRows(2);
  sheet.setRowHeight(1, 28);
  sheet.setRowHeight(2, 20);
}

/** ตั้งค่า header ของ sheet Login_Logs */
function initLogSheet(sheet) {
  sheet.appendRow(LOG_COLUMNS.map((c) => c.label));
  LOG_COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground("#1E293B")
      .setFontColor("white")
      .setFontWeight("bold")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);
}

/** ตั้งค่า header ของ sheet เช็คชื่อ */
function initAttendSheet(sheet, location) {
  sheet.appendRow(ATTEND_COLUMNS.map((c) => c.label));
  const colors = { school: "#DCFCE7", library: "#EDE9FE", meeting: "#FEE2E2" };
  ATTEND_COLUMNS.forEach((col, i) => {
    sheet
      .getRange(1, i + 1)
      .setBackground(colors[location] || "#DBEAFE")
      .setFontWeight("bold")
      .setFontColor("#1E293B")
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");
    sheet.setColumnWidth(i + 1, col.width);
  });
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 30);
}

// ═══════════════════════════════════════════════════════════════════════
//  ROW STYLING
// ═══════════════════════════════════════════════════════════════════════

/** จัด style แถวข้อมูล Students (zebra stripe + สีตาม program) */
function styleDataRow(sheet, row) {
  const bg = row % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
  sheet
    .getRange(row, 1, 1, COLUMNS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle");

  const pIdx = COLUMNS.findIndex((c) => c.key === "program") + 1;
  const pVal = sheet.getRange(row, pIdx).getValue();
  if (pVal === "ปวส")
    sheet.getRange(row, pIdx).setBackground("#FEE2E2").setFontWeight("bold");
  if (pVal === "ปวช")
    sheet.getRange(row, pIdx).setBackground("#EFF6FF").setFontWeight("bold");

  // tier 4 → ตัวสีจาง (ระบบ)
  COLUMNS.forEach((col, i) => {
    if (col.tier === 4)
      sheet
        .getRange(row, i + 1)
        .setFontColor("#94A3B8")
        .setFontStyle("italic");
  });
}

/** จัด style แถว Login_Logs (สีตาม status) */
function styleLogRow(sheet, rowNum, status) {
  const bg = rowNum % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
  sheet
    .getRange(rowNum, 1, 1, LOG_COLUMNS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle");

  const statusCol = LOG_COLUMNS.findIndex((c) => c.key === "status") + 1;
  const cell = sheet.getRange(rowNum, statusCol);
  if (status === "success")
    cell.setBackground("#DCFCE7").setFontColor("#16A34A").setFontWeight("bold");
  else if (status === "failed")
    cell.setBackground("#FEE2E2").setFontColor("#DC2626").setFontWeight("bold");
  else
    cell.setBackground("#FEF3C7").setFontColor("#D97706").setFontWeight("bold");
}

/** จัด style แถวเช็คอิน (zebra + สีตาม program) */
function styleCheckinRow(sheet, rowNum, program) {
  const bg = rowNum % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
  sheet
    .getRange(rowNum, 1, 1, ATTEND_COLUMNS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle");

  const progIdx = ATTEND_COLUMNS.findIndex((c) => c.key === "program") + 1;
  const cell = sheet.getRange(rowNum, progIdx);
  if (program === "ปวส") cell.setBackground("#FEE2E2").setFontWeight("bold");
  if (program === "ปวช") cell.setBackground("#EFF6FF").setFontWeight("bold");
}

/** ไฮไลต์ cell checkout + duration หลังเช็คเอาท์สำเร็จ */
function styleCheckedOut(sheet, rowNum) {
  sheet
    .getRange(rowNum, AI_CHECKOUT + 1)
    .setBackground("#DCFCE7")
    .setFontColor("#166534");
  sheet
    .getRange(rowNum, AI_DURATION + 1)
    .setFontWeight("bold")
    .setFontColor("#065F46");
}

// ═══════════════════════════════════════════════════════════════════════
//  DATA HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** เช็คว่า student_id ซ้ำในตารางหรือไม่ */
function isDuplicate(sheet, studentId) {
  if (!studentId) return false;
  const col = COLUMNS.findIndex((c) => c.key === "student_id") + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START) return false;
  return sheet
    .getRange(DATA_START, col, lastRow - DATA_START + 1, 1)
    .getValues()
    .some((r) => r[0].toString().trim() === studentId);
}

/** ค้นหาแถวข้อมูลของ student_id → คืนเป็น object */
function findByStudentId(sheet, studentId) {
  if (!studentId) return null;
  const col = COLUMNS.findIndex((c) => c.key === "student_id") + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START) return null;
  const all = sheet
    .getRange(DATA_START, 1, lastRow - DATA_START + 1, COLUMNS.length)
    .getValues();
  const row = all.find((r) => r[col - 1].toString().trim() === studentId);
  return row ? rowToObj(row) : null;
}

/** ค้นหาแถวข้อมูลของ uid → คืนเป็น object */
function findByUID(sheet, uid) {
  if (!uid) return null;
  const uidCol = COLUMNS.findIndex((c) => c.key === "uid");
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START) return null;
  const all = sheet
    .getRange(DATA_START, 1, lastRow - DATA_START + 1, COLUMNS.length)
    .getValues();
  const row = all.find(
    (r) => r[uidCol].toString().trim().toUpperCase() === uid.toUpperCase(),
  );
  return row ? rowToObj(row) : null;
}

/** คืนหมายเลขแถว (1-based) ของ student_id ใน sheet */
function findRowIndex(sheet, studentId) {
  if (!studentId) return null;
  const col = COLUMNS.findIndex((c) => c.key === "student_id") + 1;
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START) return null;
  const vals = sheet
    .getRange(DATA_START, col, lastRow - DATA_START + 1, 1)
    .getValues();
  const idx = vals.findIndex((r) => r[0].toString().trim() === studentId);
  return idx === -1 ? null : DATA_START + idx;
}

/** ดึงข้อมูลนักเรียนทุกแถว → array of objects */
function getAllRows(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START) return [];
  return sheet
    .getRange(DATA_START, 1, lastRow - DATA_START + 1, COLUMNS.length)
    .getValues()
    .map(rowToObj);
}

/** แปลง array แถวเป็น object ตาม COLUMNS keys */
function rowToObj(row) {
  return Object.fromEntries(COLUMNS.map((c, i) => [c.key, row[i]]));
}

/**
 * หาแถวเช็คอินที่ยัง open (ไม่มี checkout) ของ uid นั้น
 * scan จากล่างขึ้นบน → พบแถวแรกของ uid ที่ checkout ว่าง = open session
 */
function findOpenCheckin(sheet, uid) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { row: null, rowNum: -1 };
  for (let r = lastRow; r >= 2; r--) {
    const rowData = sheet
      .getRange(r, 1, 1, ATTEND_COLUMNS.length)
      .getValues()[0];
    if (rowData[AI_UID].toString().trim().toUpperCase() !== uid) continue;
    // พบแถวของ uid: ถ้า checkout ว่าง = open session
    return rowData[AI_CHECKOUT].toString().trim()
      ? { row: null, rowNum: -1 }
      : { row: rowData, rowNum: r };
  }
  return { row: null, rowNum: -1 };
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════

/** คืนเวลาปัจจุบัน Bangkok timezone รูปแบบ dd/MM/yyyy HH:mm:ss */
function now_bkk() {
  return Utilities.formatDate(
    new Date(),
    "Asia/Bangkok",
    "dd/MM/yyyy HH:mm:ss",
  );
}

/** สร้าง UID = student_id + "-" + random 8 hex ตัวพิมพ์ใหญ่ */
function generateUID(studentId) {
  const suffix = Utilities.getUuid()
    .replace(/-/g, "")
    .substring(0, 8)
    .toUpperCase();
  return `${studentId}-${suffix}`;
}

/**
 * คำนวณ duration ระหว่าง 2 timestamp (รูปแบบ "dd/MM/yyyy HH:mm:ss")
 * คืนสตริง เช่น "1 ชม. 30 นาที" หรือ "45 นาที"
 */
function calcDuration(fromStr, toStr) {
  try {
    const parse = (s) => {
      const [d, t] = s.split(" ");
      const [dd, mm, yyyy] = d.split("/");
      const [hh, mi, ss] = t.split(":");
      return new Date(yyyy, mm - 1, dd, hh, mi, ss);
    };
    const diff = Math.round((parse(toStr) - parse(fromStr)) / 60000);
    if (diff < 0) return "—";
    const h = Math.floor(diff / 60),
      m = diff % 60;
    return h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
  } catch (_) {
    return "—";
  }
}

/** ส่งอีเมลแจ้งเตือนเมื่อมีนักเรียนลงทะเบียนใหม่ */
function notifyEmail(p, uid, timestamp) {
  const name = `${p.first_name} ${p.last_name}`;
  const subject = `📋 ลงทะเบียนใหม่ — ${name} (${p.student_id})`;
  const body = [
    "มีนักเรียนลงทะเบียนใหม่",
    `บันทึกเมื่อ : ${timestamp}`,
    "═".repeat(44),
    `  รหัสนักเรียน  ${p.student_id}`,
    `  ชื่อ-นามสกุล ${name}`,
    `  ระดับ         ${p.program}`,
    `  UID           ${uid}`,
    "═".repeat(44),
  ].join("\n");
  GmailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}

/**
 * สร้าง JSON/JSONP response — แก้ CORS เมื่อเรียกจาก localhost หรือ domain อื่น
 * ─ ถ้ามี cb (callback param จาก jQuery JSONP) → คืน JSONP
 * ─ ถ้าไม่มี → คืน JSON ปกติ (ESP32, server-side, etc.)
 *
 * วิธีใช้ใน action handler:
 *   return res({ status:"ok" }, e.parameter.callback, cb);
 */
function res(obj, cb) {
  const json = JSON.stringify(obj);
  if (cb) {
    return ContentService.createTextOutput(cb + "(" + json + ")").setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(json).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/** ส่งข้อความ push ผ่าน LINE Messaging API */
function sendLine(msg) {
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    headers: { Authorization: "Bearer " + LINE_TOKEN },
    contentType: "application/json",
    payload: JSON.stringify({
      to: LINE_USER,
      messages: [{ type: "text", text: msg }],
    }),
  });
}

// ═══════════════════════════════════════════════════════════════════════
//  Products.gs — สหกรณ์โรงเรียน ASIA-LB
//  ผู้พัฒนา: Centered101
//
//  วิธีใช้งาน:
//    1. วางไฟล์นี้ไว้ใน Google Apps Script เดียวกับ Students.gs
//    2. เพิ่ม case ใน doGet(e) ของ Students.gs:
//         case "get_products":      return handleGetProducts(e);
//         case "create_order":      return handleCreateOrder(e);
//         case "check_payment":     return handleCheckPayment(e);
//         case "confirm_payment":   return handleConfirmPayment(e);
//         case "get_orders":        return handleGetOrders(e);
//         case "update_stock":      return handleUpdateStock(e);
//
//  Sheet "สินค้า"  : A=id | B=tag | C=stock | D=name | E=price | F=images | G=unit | H=cat | I=cpst
//  Sheet "ออเดอร์" : A=order_id | B=timestamp | C=student_id | D=student_name
//                    E=items(JSON) | F=total | G=status | H=paid_at | I=note | J=ip
// ═══════════════════════════════════════════════════════════════════════

// ── ชื่อ Sheet ─────────────────────────────────────────────────────────
const SHOP_SHEET = "สินค้า";
const ORDER_SHEET = "ออเดอร์";

// ── รหัสลับสำหรับ Admin confirm (เปลี่ยนเป็นรหัสของตัวเอง!) ──────────
const ADMIN_SECRET = "ASIALB2025";

// ── PromptPay ──────────────────────────────────────────────────────────
const PROMPTPAY_NUMBER = "0917576442"; // เบอร์/เลขประจำตัวประชาชนสหกรณ์

// ── นิยาม Column ของ Sheet "ออเดอร์" ──────────────────────────────────
const ORDER_COLS = [
  "order_id", // A — รหัสออเดอร์  ORD-XXXXX
  "timestamp", // B — เวลาสร้าง
  "student_id", // C — รหัสนักเรียน
  "student_name", // D — ชื่อ-นามสกุล
  "items", // E — JSON array ของสินค้า
  "total", // F — ยอดรวม
  "status", // G — pending | paid | cancelled
  "paid_at", // H — เวลายืนยันการจ่าย
  "note", // I — หมายเหตุ
  "ip", // J — IP ผู้สั่ง
];

// col index (0-based)
const OI = Object.fromEntries(ORDER_COLS.map((k, i) => [k, i]));

// ═══════════════════════════════════════════════════════════════════════
//  1. GET PRODUCTS — ดึงสินค้าทั้งหมดจาก Sheet
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=get_products
 * ?action=get_products&cat=เครื่องเขียน   (filter by category)
 * ?action=get_products&in_stock=1          (แสดงเฉพาะมีสต็อก)
 */
function handleGetProducts(e, cb) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHOP_SHEET);
    if (!sheet)
      return res(
        { status: "error", message: `ไม่พบ Sheet '${SHOP_SHEET}'` },
        cb,
      );

    const rows = sheet.getDataRange().getValues();
    const catFilter = (e.parameter.cat || "").trim();
    const inStockOnly = e.parameter.in_stock === "1";

    const data = [];
    for (let i = 1; i < rows.length; i++) {
      // ข้ามหัวตาราง แถว 0
      const r = rows[i];
      if (!r[0] && !r[3]) continue; // ข้ามแถวว่าง (id หรือ name ต้องมี)

      const item = {
        id: r[0] !== "" ? Number(r[0]) : i,
        tag: String(r[1] || "").trim(),
        stock: parseInt(r[2]) || 0,
        name: String(r[3] || "").trim(),
        price: parseFloat(r[4]) || 0,
        images: String(r[5] || "").trim(),
        unit: String(r[6] || "ชิ้น").trim(),
        cat: String(r[7] || "อื่นๆ").trim(),
        cpst: parseFloat(r[8]) || 0, // ต้นทุน
      };

      if (catFilter && item.cat !== catFilter) continue;
      if (inStockOnly && item.stock <= 0) continue;

      data.push(item);
    }

    return res({ status: "success", count: data.length, data }, cb);
  } catch (err) {
    return res({ status: "error", message: err.message }, cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  2. CREATE ORDER — สร้างออเดอร์ใหม่ (status = pending)
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=create_order
 *   &student_id=6601234
 *   &student_name=สมชาย+ใจดี
 *   &items=[{"id":1,"name":"ดินสอ","price":15,"qty":2}]
 *   &total=30
 *   &note=ห้อง+ว.101
 */
function handleCreateOrder(e, cb) {
  try {
    const p = e.parameter;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // ── ตรวจสอบข้อมูลที่จำเป็น ─────────────────────────────────
    if (!p.student_id || !p.items || !p.total)
      return res(
        {
          status: "error",
          message: "ข้อมูลไม่ครบ: ต้องมี student_id, items, total",
        },
        cb,
      );

    let items;
    try {
      items = JSON.parse(p.items);
    } catch (_) {
      return res(
        { status: "error", message: "items ไม่ใช่ JSON ที่ถูกต้อง" },
        cb,
      );
    }
    if (!Array.isArray(items) || !items.length)
      return res({ status: "error", message: "items ว่างเปล่า" }, cb);

    // ── ตรวจสต็อกก่อนสร้างออเดอร์ ─────────────────────────────
    const shopSheet = ss.getSheetByName(SHOP_SHEET);
    const stockError = checkStockAvailability(shopSheet, items);
    if (stockError) return res({ status: "error", message: stockError }, cb);

    // ── สร้าง/เตรียม Sheet "ออเดอร์" ────────────────────────────
    let orderSheet = ss.getSheetByName(ORDER_SHEET);
    if (!orderSheet) {
      orderSheet = ss.insertSheet(ORDER_SHEET);
      // สร้าง header
      const header = ORDER_COLS.map((k) => k);
      orderSheet.appendRow(header);
      styleOrderHeader(orderSheet);
    }

    // ── สร้าง order_id unique ────────────────────────────────────
    const orderId = generateOrderId();
    const nowStr = now_bkk();

    const row = new Array(ORDER_COLS.length).fill("");
    row[OI.order_id] = orderId;
    row[OI.timestamp] = nowStr;
    row[OI.student_id] = String(p.student_id).trim();
    row[OI.student_name] = String(p.student_name || "").trim();
    row[OI.items] = JSON.stringify(items);
    row[OI.total] = parseFloat(p.total) || 0;
    row[OI.status] = "pending";
    row[OI.paid_at] = "";
    row[OI.note] = String(p.note || "").trim();
    row[OI.ip] = e.parameter.ip || "";

    orderSheet.appendRow(row);
    const newRow = orderSheet.getLastRow();
    styleOrderRow(orderSheet, newRow, "pending");

    // ── แจ้งเตือน LINE (มีออเดอร์ใหม่!) ─────────────────────────
    const itemSummary = items.map((i) => `${i.name} × ${i.qty}`).join(", ");
    notifyLineOrder({
      type: "new",
      orderId,
      nowStr,
      studentId: p.student_id,
      studentName: p.student_name || "ไม่ระบุ",
      total: parseFloat(p.total),
      items: itemSummary,
    });

    return res(
      {
        status: "success",
        order_id: orderId,
        promptpay: PROMPTPAY_NUMBER,
        total: parseFloat(p.total),
        message: "สร้างออเดอร์สำเร็จ รอการชำระเงิน",
      },
      cb,
    );
  } catch (err) {
    return res({ status: "error", message: err.message }, cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  3. CHECK PAYMENT — Frontend polling สถานะออเดอร์
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=check_payment&order_id=ORD-XXXXX
 *
 * คืน:
 *   { status:"success", payment_status:"pending"|"paid"|"cancelled", order:{...} }
 */
function handleCheckPayment(e, cb) {
  try {
    const orderId = (e.parameter.order_id || "").trim();
    if (!orderId)
      return res({ status: "error", message: "ต้องระบุ order_id" }, cb);

    const order = findOrder(orderId);
    if (!order)
      return res({ status: "error", message: `ไม่พบออเดอร์ ${orderId}` }, cb);

    return res(
      {
        status: "success",
        payment_status: order.status,
        order: {
          order_id: order.order_id,
          student_id: order.student_id,
          student_name: order.student_name,
          total: parseFloat(order.total) || 0,
          status: order.status,
          timestamp: order.timestamp,
          paid_at: order.paid_at,
          items: parseOrderItems(order.items),
        },
      },
      cb,
    );
  } catch (err) {
    return res({ status: "error", message: err.message }, cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  4. CONFIRM PAYMENT — Admin/ผู้ดูแลยืนยันการจ่าย
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=confirm_payment&order_id=ORD-XXXXX&secret=ASIALB2025
 * ?action=confirm_payment&order_id=ORD-XXXXX&secret=ASIALB2025&cancel=1  (ยกเลิก)
 *
 * เมื่อยืนยัน:
 *   1. อัปเดต status → paid + บันทึกเวลา paid_at
 *   2. หักสต็อกสินค้าในชีต "สินค้า"
 *   3. แจ้งเตือน LINE
 */
function handleConfirmPayment(e, cb) {
  try {
    const orderId = (e.parameter.order_id || "").trim();
    const secret = (e.parameter.secret || "").trim();
    const cancel = e.parameter.cancel === "1";

    // ── ตรวจรหัสผ่าน admin ──────────────────────────────────────
    if (secret !== ADMIN_SECRET)
      return res({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, cb);

    if (!orderId)
      return res({ status: "error", message: "ต้องระบุ order_id" }, cb);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName(ORDER_SHEET);
    if (!orderSheet)
      return res(
        { status: "error", message: `ไม่พบ Sheet '${ORDER_SHEET}'` },
        cb,
      );

    // ── ค้นหาแถวออเดอร์ ──────────────────────────────────────────
    const rowNum = findOrderRow(orderSheet, orderId);
    if (!rowNum)
      return res({ status: "error", message: `ไม่พบออเดอร์ ${orderId}` }, cb);

    const rowData = orderSheet
      .getRange(rowNum, 1, 1, ORDER_COLS.length)
      .getValues()[0];
    const currentStatus = String(rowData[OI.status]).trim();

    // ── ป้องกันยืนยันซ้ำ ──────────────────────────────────────────
    if (currentStatus === "paid")
      return res(
        { status: "error", message: `ออเดอร์ ${orderId} ยืนยันแล้ว` },
        cb,
      );
    if (currentStatus === "cancelled" && !cancel)
      return res(
        { status: "error", message: `ออเดอร์ ${orderId} ถูกยกเลิกแล้ว` },
        cb,
      );

    const nowStr = now_bkk();
    const newStatus = cancel ? "cancelled" : "paid";

    // ── อัปเดต status + paid_at ───────────────────────────────────
    orderSheet.getRange(rowNum, OI.status + 1).setValue(newStatus);
    orderSheet.getRange(rowNum, OI.paid_at + 1).setValue(cancel ? "" : nowStr);
    styleOrderRow(orderSheet, rowNum, newStatus);

    let message = cancel ? "ยกเลิกออเดอร์สำเร็จ" : "ยืนยันการชำระเงินสำเร็จ";

    // ── หักสต็อก (เฉพาะกรณี paid) ────────────────────────────────
    if (!cancel) {
      const items = parseOrderItems(String(rowData[OI.items]));
      const shopSheet = ss.getSheetByName(SHOP_SHEET);
      if (shopSheet && items.length) {
        const deductResult = deductStock(shopSheet, items);
        if (deductResult.error) {
          // ยังถือว่า paid แต่แจ้งว่าสต็อกมีปัญหา
          message += ` (⚠️ หักสต็อกไม่สมบูรณ์: ${deductResult.error})`;
        }
      }
    }

    // ── แจ้งเตือน LINE ────────────────────────────────────────────
    notifyLineOrder({
      type: cancel ? "cancel" : "paid",
      orderId,
      nowStr,
      studentName: String(rowData[OI.student_name]),
      total: parseFloat(rowData[OI.total]) || 0,
    });

    return res(
      { status: "success", message, order_id: orderId, new_status: newStatus },
      cb,
    );
  } catch (err) {
    return res({ status: "error", message: err.message }, cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  5. GET ORDERS — ดูรายการออเดอร์ (Admin)
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=get_orders&secret=ASIALB2025
 * ?action=get_orders&secret=ASIALB2025&status=pending   (filter)
 * ?action=get_orders&secret=ASIALB2025&student_id=6601234
 * ?action=get_orders&secret=ASIALB2025&limit=50
 */
function handleGetOrders(e, cb) {
  try {
    if ((e.parameter.secret || "") !== ADMIN_SECRET)
      return res({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, cb);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const orderSheet = ss.getSheetByName(ORDER_SHEET);
    if (!orderSheet) return res({ status: "success", count: 0, data: [] }, cb);

    const lastRow = orderSheet.getLastRow();
    if (lastRow < 2) return res({ status: "success", count: 0, data: [] }, cb);

    const allRows = orderSheet
      .getRange(2, 1, lastRow - 1, ORDER_COLS.length)
      .getValues();
    const statusF = (e.parameter.status || "").trim();
    const stuF = (e.parameter.student_id || "").trim();
    const limit = parseInt(e.parameter.limit) || 100;

    let data = allRows
      .filter((r) => r[OI.order_id])
      .map((r) => ({
        order_id: String(r[OI.order_id]),
        timestamp: String(r[OI.timestamp]),
        student_id: String(r[OI.student_id]),
        student_name: String(r[OI.student_name]),
        items: parseOrderItems(String(r[OI.items])),
        total: parseFloat(r[OI.total]) || 0,
        status: String(r[OI.status]),
        paid_at: String(r[OI.paid_at]),
        note: String(r[OI.note]),
      }))
      .filter((o) => !statusF || o.status === statusF)
      .filter((o) => !stuF || o.student_id === stuF)
      .reverse() // ล่าสุดก่อน
      .slice(0, limit);

    return res({ status: "success", count: data.length, data }, cb);
  } catch (err) {
    return res({ status: "error", message: err.message }, cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  6. UPDATE STOCK — อัปเดตสต็อกสินค้า (Admin)
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=update_stock&secret=ASIALB2025&id=1&stock=100
 * ?action=update_stock&secret=ASIALB2025&id=1&delta=+50   (เพิ่ม/ลดแบบ relative)
 */
function handleUpdateStock(e, cb) {
  try {
    if ((e.parameter.secret || "") !== ADMIN_SECRET)
      return res({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" }, cb);

    const productId = parseInt(e.parameter.id);
    if (!productId)
      return res({ status: "error", message: "ต้องระบุ id สินค้า" }, cb);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shopSheet = ss.getSheetByName(SHOP_SHEET);
    if (!shopSheet)
      return res(
        { status: "error", message: `ไม่พบ Sheet '${SHOP_SHEET}'` },
        cb,
      );

    const rows = shopSheet.getDataRange().getValues();
    let rowNum = -1;
    for (let i = 1; i < rows.length; i++) {
      if (Number(rows[i][0]) === productId) {
        rowNum = i + 1;
        break;
      }
    }
    if (rowNum === -1)
      return res(
        { status: "error", message: `ไม่พบสินค้า id=${productId}` },
        cb,
      );

    const stockCell = shopSheet.getRange(rowNum, 3); // Column C = stock
    const curStock = parseInt(stockCell.getValue()) || 0;

    let newStock;
    if (e.parameter.delta !== undefined) {
      const delta = parseInt(e.parameter.delta);
      newStock = Math.max(0, curStock + delta);
    } else {
      newStock = Math.max(0, parseInt(e.parameter.stock) || 0);
    }

    stockCell.setValue(newStock);

    return res(
      {
        status: "success",
        message: "อัปเดตสต็อกสำเร็จ",
        id: productId,
        old_stock: curStock,
        new_stock: newStock,
      },
      cb,
    );
  } catch (err) {
    return res({ status: "error", message: err.message }, cb);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  ADMIN PAGE — หน้าดูออเดอร์สำหรับผู้ดูแล (doGet ส่งคืน HTML)
// ═══════════════════════════════════════════════════════════════════════
/**
 * ?action=admin_orders&secret=ASIALB2025
 * คืน HTML หน้า admin ยืนยันออเดอร์ เรียกผ่าน browser ได้เลย
 */
function handleAdminOrdersPage(e) {
  if ((e.parameter.secret || "") !== ADMIN_SECRET)
    return HtmlService.createHtmlOutput("<h2>❌ รหัสผ่านไม่ถูกต้อง</h2>");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName(ORDER_SHEET);
  const scriptUrl = ScriptApp.getService().getUrl();

  let rows = [];
  if (orderSheet && orderSheet.getLastRow() >= 2) {
    const all = orderSheet
      .getRange(2, 1, orderSheet.getLastRow() - 1, ORDER_COLS.length)
      .getValues();
    rows = all
      .filter((r) => r[OI.order_id] && r[OI.status] === "pending")
      .reverse();
  }

  const rowsHtml = rows
    .map((r) => {
      const orderId = r[OI.order_id];
      const items = parseOrderItems(String(r[OI.items]));
      const summary = items.map((i) => `${i.name} × ${i.qty}`).join(", ");
      return `<tr>
      <td>${orderId}</td>
      <td>${r[OI.timestamp]}</td>
      <td>${r[OI.student_id]}</td>
      <td>${r[OI.student_name]}</td>
      <td style="font-size:12px">${summary}</td>
      <td style="font-weight:bold;color:#0EA5E9">฿${r[OI.total]}</td>
      <td>
        <a href="${scriptUrl}?action=confirm_payment&order_id=${orderId}&secret=${ADMIN_SECRET}"
           onclick="return confirm('ยืนยันชำระเงิน ${orderId}?')"
           style="background:#22c55e;color:white;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:12px">
           ✅ ยืนยัน
        </a>
        &nbsp;
        <a href="${scriptUrl}?action=confirm_payment&order_id=${orderId}&secret=${ADMIN_SECRET}&cancel=1"
           onclick="return confirm('ยกเลิกออเดอร์ ${orderId}?')"
           style="background:#FE4040;color:white;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:12px">
           ❌ ยกเลิก
        </a>
      </td>
    </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>Admin Orders — ASIA-LB</title>
    <meta http-equiv="refresh" content="15">
    <style>
      body{font-family:'Kanit',sans-serif;padding:20px;background:#F8FAFC}
      h1{color:#0EA5E9;margin-bottom:4px}
      .badge{background:#FEF9C3;color:#92400E;padding:2px 8px;border-radius:12px;font-size:12px}
      table{width:100%;border-collapse:collapse;background:white;border-radius:12px;overflow:hidden;
            box-shadow:0 2px 8px rgba(0,0,0,.08)}
      th{background:#0EA5E9;color:white;padding:10px 12px;text-align:left;font-size:13px}
      td{padding:9px 12px;border-bottom:1px solid #F1F5F9;font-size:13px;vertical-align:middle}
      tr:last-child td{border-bottom:none}
      .empty{text-align:center;padding:40px;color:#94A3B8}
      .refresh{font-size:11px;color:#94A3B8}
    </style></head><body>
    <h1>🏪 สหกรณ์โรงเรียน — ออเดอร์รอยืนยัน</h1>
    <p class="refresh">⟳ รีเฟรชอัตโนมัติทุก 15 วินาที — ${new Date().toLocaleString("th-TH")}</p>
    <span class="badge">รอยืนยัน ${rows.length} รายการ</span><br><br>
    ${
      rows.length
        ? `
    <table>
      <thead><tr>
        <th>ออเดอร์</th><th>เวลา</th><th>รหัส</th><th>ชื่อ</th><th>รายการ</th><th>ยอด</th><th>จัดการ</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`
        : `<div class="empty">🎉 ไม่มีออเดอร์รอยืนยัน</div>`
    }
    </body></html>`;

  return HtmlService.createHtmlOutput(html)
    .setTitle("Admin Orders — ASIA-LB")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// เพิ่ม case นี้ด้วยใน doGet:
//   case "admin_orders": return handleAdminOrdersPage(e);

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS — STOCK
// ═══════════════════════════════════════════════════════════════════════

/** ตรวจสต็อกก่อนสร้างออเดอร์ คืน null ถ้าผ่าน หรือ string error */
function checkStockAvailability(shopSheet, items) {
  if (!shopSheet) return null;
  const rows = shopSheet.getDataRange().getValues();
  for (const item of items) {
    const row = rows.find((r) => Number(r[0]) === Number(item.id));
    if (!row) return `ไม่พบสินค้า id=${item.id} ในระบบ`;
    const avail = parseInt(row[2]) || 0; // col C = stock
    if (avail < item.qty)
      return `${item.name} สต็อกไม่พอ (มี ${avail} ต้องการ ${item.qty})`;
  }
  return null;
}

/** หักสต็อกหลัง paid คืน { error } ถ้ามีปัญหา */
function deductStock(shopSheet, items) {
  try {
    const rows = shopSheet.getDataRange().getValues();
    for (const item of items) {
      for (let i = 1; i < rows.length; i++) {
        if (Number(rows[i][0]) !== Number(item.id)) continue;
        const cur = parseInt(rows[i][2]) || 0;
        const newStock = Math.max(0, cur - item.qty);
        shopSheet.getRange(i + 1, 3).setValue(newStock); // col C = stock
        break;
      }
    }
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS — ORDER LOOKUP
// ═══════════════════════════════════════════════════════════════════════

/** ค้นหา order object จาก order_id */
function findOrder(orderId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const orderSheet = ss.getSheetByName(ORDER_SHEET);
  if (!orderSheet || orderSheet.getLastRow() < 2) return null;
  const rows = orderSheet
    .getRange(2, 1, orderSheet.getLastRow() - 1, ORDER_COLS.length)
    .getValues();
  const row = rows.find((r) => String(r[OI.order_id]).trim() === orderId);
  if (!row) return null;
  return Object.fromEntries(ORDER_COLS.map((k, i) => [k, row[i]]));
}

/** ค้นหาหมายเลขแถว (1-based) ของ order_id ใน sheet */
function findOrderRow(orderSheet, orderId) {
  const lastRow = orderSheet.getLastRow();
  if (lastRow < 2) return null;
  const col = OI.order_id + 1;
  const vals = orderSheet.getRange(2, col, lastRow - 1, 1).getValues();
  const idx = vals.findIndex((r) => String(r[0]).trim() === orderId);
  return idx === -1 ? null : idx + 2;
}

/** parse items JSON safely */
function parseOrderItems(jsonStr) {
  try {
    const arr = JSON.parse(jsonStr || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS — LINE NOTIFY
// ═══════════════════════════════════════════════════════════════════════

function notifyLineOrder(opt) {
  try {
    let msg = "";
    if (opt.type === "new") {
      msg = [
        "🛒 ออเดอร์ใหม่! สหกรณ์โรงเรียน",
        `📋 ออเดอร์  : ${opt.orderId}`,
        `👤 นักเรียน : ${opt.studentName} (${opt.studentId})`,
        `📦 รายการ   : ${opt.items}`,
        `💰 ยอดรวม   : ฿${opt.total}`,
        `🕐 เวลา     : ${opt.nowStr}`,
        "",
        "⏳ รอยืนยันการโอนเงิน",
      ].join("\n");
    } else if (opt.type === "paid") {
      msg = [
        "✅ ยืนยันชำระเงินแล้ว!",
        `📋 ออเดอร์  : ${opt.orderId}`,
        `👤 นักเรียน : ${opt.studentName}`,
        `💰 ยอดรวม   : ฿${opt.total}`,
        `🕐 เวลา     : ${opt.nowStr}`,
      ].join("\n");
    } else if (opt.type === "cancel") {
      msg = [
        "❌ ยกเลิกออเดอร์",
        `📋 ออเดอร์  : ${opt.orderId}`,
        `👤 นักเรียน : ${opt.studentName}`,
      ].join("\n");
    }
    if (msg) sendLine(msg);
  } catch (_) {
    // ไม่ให้ error LINE ทำให้ main flow พัง
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  HELPERS — STYLE
// ═══════════════════════════════════════════════════════════════════════

function styleOrderHeader(sheet) {
  const range = sheet.getRange(1, 1, 1, ORDER_COLS.length);
  range
    .setBackground("#0EA5E9")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(11)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  const widths = [130, 155, 110, 160, 300, 80, 90, 155, 160, 130];
  widths.forEach((w, i) => {
    if (i < ORDER_COLS.length) sheet.setColumnWidth(i + 1, w);
  });
}

function styleOrderRow(sheet, rowNum, status) {
  const bg = rowNum % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
  sheet
    .getRange(rowNum, 1, 1, ORDER_COLS.length)
    .setBackground(bg)
    .setVerticalAlignment("middle")
    .setFontSize(11);

  const statusCell = sheet.getRange(rowNum, OI.status + 1);
  if (status === "paid") {
    statusCell
      .setBackground("#DCFCE7")
      .setFontColor("#16A34A")
      .setFontWeight("bold");
  } else if (status === "pending") {
    statusCell
      .setBackground("#FEF9C3")
      .setFontColor("#92400E")
      .setFontWeight("bold");
  } else if (status === "cancelled") {
    statusCell
      .setBackground("#FEE2E2")
      .setFontColor("#DC2626")
      .setFontWeight("bold");
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════════════

/** สร้าง Order ID รูปแบบ ORD-XXXXX (ตัวเลขและตัวอักษรพิมพ์ใหญ่) */
function generateOrderId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "ORD-";
  for (let i = 0; i < 6; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

/** คืนเวลาปัจจุบัน Bangkok timezone (ถ้า now_bkk ไม่มีใน scope นี้) */
function now_bkk_local() {
  return Utilities.formatDate(
    new Date(),
    "Asia/Bangkok",
    "dd/MM/yyyy HH:mm:ss",
  );
}
// หมายเหตุ: ถ้า now_bkk มีอยู่แล้วใน Students.gs จะใช้จาก scope นั้นแทน
// ถ้าไม่มี ให้เปลี่ยน now_bkk() → now_bkk_local() ในฟังก์ชันข้างบน

// ═══════════════════════════════════════════════════════════════════════
//  SWITCH CASES ที่ต้องเพิ่มใน doGet() ของ Students.gs
// ═══════════════════════════════════════════════════════════════════════
/*

  ── เพิ่มใน switch(action) ของ doGet ──────────────────────────────────

    case "get_products":    return handleGetProducts(e);
    case "create_order":    return handleCreateOrder(e);
    case "check_payment":   return handleCheckPayment(e);
    case "confirm_payment": return handleConfirmPayment(e);
    case "get_orders":      return handleGetOrders(e);
    case "update_stock":    return handleUpdateStock(e);
    case "admin_orders":    return handleAdminOrdersPage(e);

  ── สรุป Endpoints ────────────────────────────────────────────────────

  GET ?action=get_products
      [&cat=เครื่องเขียน] [&in_stock=1]
      → ดึงสินค้าทั้งหมด / filter หมวด / filter มีสต็อก

  GET ?action=create_order
      &student_id=6601234 &student_name=สมชาย+ใจดี
      &items=[{...}] &total=30 [&note=ห้อง101]
      → สร้างออเดอร์ คืน { order_id, promptpay, total }

  GET ?action=check_payment&order_id=ORD-XXXXX
      → poll สถานะ คืน { payment_status: "pending"|"paid"|"cancelled" }

  GET ?action=confirm_payment
      &order_id=ORD-XXXXX &secret=ASIALB2025
      [&cancel=1]
      → admin ยืนยัน/ยกเลิก → หักสต็อก + แจ้ง LINE

  GET ?action=get_orders
      &secret=ASIALB2025
      [&status=pending] [&student_id=xxx] [&limit=50]
      → ดูรายการออเดอร์

  GET ?action=update_stock
      &secret=ASIALB2025 &id=1 &stock=100
      หรือ &delta=+20 / &delta=-5
      → อัปเดตสต็อกสินค้า

  GET ?action=admin_orders&secret=ASIALB2025
      → เปิด HTML หน้า admin ยืนยันออเดอร์ในเบราว์เซอร์ได้เลย

*/
