import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildRfidScanFlexMessage, sendLineFlexMessage } from "@/lib/line";
import { getLineNotificationTarget } from "@/lib/line-targets";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Location = "school" | "library" | "meeting";
type Action = "in" | "out";
type PublicAction = "checkin" | "checkout";

type ScanBody = {
  uid?: string;
  location?: Location;
  device_id?: string;
  station_secret?: string;
};

const LOCATION_LABEL: Record<Location, string> = {
  school: "โรงเรียน",
  library: "ห้องสมุด",
  meeting: "ห้องประชุม",
};

const VALID_LOCATIONS = new Set<Location>(["school", "library", "meeting"]);

function normalizeUid(uid: string) {
  return uid.trim().replace(/[\s:-]/g, "").toUpperCase();
}

function displayUid(uid: string) {
  return uid.trim().replace(/\s/g, "").toUpperCase();
}

function colonUid(uid: string) {
  const normalized = normalizeUid(uid);
  return normalized.match(/.{1,2}/g)?.join(":") ?? normalized;
}

function uidCandidates(uid: string) {
  const raw = uid.trim().replace(/\s/g, "").toUpperCase();
  const compact = normalizeUid(uid);
  const prefixed = raw.includes("-") ? raw : null;
  return Array.from(new Set([raw, compact, colonUid(uid), prefixed].filter(Boolean) as string[]));
}

function bangkokDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function bangkokTime() {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function durationText(fromIso: string, toIso: string) {
  const seconds = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} ชม. ${m} นาที ${s} วินาที`;
  if (m > 0) return `${m} นาที ${s} วินาที`;
  return `${s} วินาที`;
}

function durationMinutes(fromIso: string, toIso: string) {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
}

function oled(lines: string[], tone: "success" | "warning" | "error") {
  return {
    display: {
      type: "oled",
      lines: lines.slice(0, 4),
      clear: true,
      duration_ms: 2500,
    },
    speaker: {
      tone,
      beeps: tone === "success" ? [120, 80, 120] : tone === "warning" ? [220] : [320, 120, 320],
    },
  };
}

function publicAction(action: Action): PublicAction {
  return action === "in" ? "checkin" : "checkout";
}

type StudentForScan = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  program: string;
  department: string | null;
  card_status: string | null;
  photo_url?: string | null;
  line_user_id?: string | null;
};

type CardLookupResult = {
  student: StudentForScan | null;
  cardStatus: string | null;
  source: "rfid_cards" | "student_cards" | "students";
};

type AttendanceLogSession = {
  action: Action;
  duration: string | null;
  durationMinutes: number | null;
  logId: string | null;
  usedAttendanceLogs: boolean;
};

async function findStudentByUid(uid: string): Promise<CardLookupResult> {
  const candidates = uidCandidates(uid);
  const rfidCardResult = await (supabase as any)
    .from("rfid_cards")
    .select("student_id, uid, status")
    .in("uid", candidates)
    .maybeSingle();

  if (!rfidCardResult.error && rfidCardResult.data) {
    const { data: student, error: studentError } = await (supabase as any)
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, photo_url, line_user_id")
      .eq("student_id", rfidCardResult.data.student_id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);

    return {
      student: student ? ({ ...student, card_status: rfidCardResult.data.status } as StudentForScan) : null,
      cardStatus: rfidCardResult.data.status ?? null,
      source: "rfid_cards",
    };
  }

  const missingRfidCardsTable = rfidCardResult.error?.code === "42P01" || /rfid_cards/i.test(rfidCardResult.error?.message ?? "");
  if (rfidCardResult.error && !missingRfidCardsTable) {
    throw new Error(rfidCardResult.error.message);
  }

  const cardResult = await (supabase as any)
    .from("student_cards")
    .select("student_id, uid, card_status")
    .in("uid", candidates)
    .maybeSingle();

  if (!cardResult.error && cardResult.data) {
    const { data: student, error: studentError } = await (supabase as any)
      .from("students")
      .select("student_id, first_name, last_name, nickname, program, department, photo_url, line_user_id")
      .eq("student_id", cardResult.data.student_id)
      .maybeSingle();

    if (studentError) throw new Error(studentError.message);

    return {
      student: student ? ({ ...student, card_status: cardResult.data.card_status } as StudentForScan) : null,
      cardStatus: cardResult.data.card_status ?? null,
      source: "student_cards",
    };
  }

  const missingStudentCardsTable = cardResult.error?.code === "42P01" || /student_cards/i.test(cardResult.error?.message ?? "");
  if (cardResult.error && !missingStudentCardsTable) {
    throw new Error(cardResult.error.message);
  }

  const { data: student, error } = await (supabase as any)
    .from("students")
    .select("student_id, first_name, last_name, nickname, program, department, card_status, photo_url, line_user_id")
    .in("uid", candidates)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    student: student as StudentForScan | null,
    cardStatus: (student as StudentForScan | null)?.card_status ?? null,
    source: "students",
  };
}

async function recordAttendanceSession(params: {
  studentId: string;
  uid: string;
  location: Location;
  now: string;
  date: string;
}): Promise<AttendanceLogSession> {
  const { studentId, uid, location, now, date } = params;

  const openLogResult = await (supabase as any)
    .from("attendance_logs")
    .select("id, check_in")
    .eq("student_id", studentId)
    .eq("uid", uid)
    .eq("location", location)
    .is("check_out", null)
    .order("check_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  const missingAttendanceLogsTable = openLogResult.error?.code === "42P01" || /attendance_logs/i.test(openLogResult.error?.message ?? "");
  if (openLogResult.error && !missingAttendanceLogsTable) {
    throw new Error(openLogResult.error.message);
  }

  if (!missingAttendanceLogsTable) {
    if (openLogResult.data?.id) {
      const minutes = openLogResult.data.check_in ? durationMinutes(openLogResult.data.check_in, now) : null;
      const { error } = await (supabase as any)
        .from("attendance_logs")
        .update({
          check_out: now,
          duration_minutes: minutes,
        })
        .eq("id", openLogResult.data.id);
      if (error) throw new Error(error.message);

      return {
        action: "out",
        duration: openLogResult.data.check_in ? durationText(openLogResult.data.check_in, now) : null,
        durationMinutes: minutes,
        logId: openLogResult.data.id,
        usedAttendanceLogs: true,
      };
    }

    const { data: inserted, error } = await (supabase as any)
      .from("attendance_logs")
      .insert({
        student_id: studentId,
        uid,
        location,
        check_in: now,
        check_out: null,
        duration_minutes: null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return {
      action: "in",
      duration: null,
      durationMinutes: null,
      logId: inserted?.id ?? null,
      usedAttendanceLogs: true,
    };
  }

  const { data: openAttendance, error: openError } = await supabase
    .from("attendance")
    .select("id, checkin_time")
    .eq("student_id", studentId)
    .eq("location", location)
    .eq("date", date)
    .is("checkout_time", null)
    .order("checkin_time", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (openError) throw new Error(openError.message);

  if (openAttendance?.id) {
    const minutes = openAttendance.checkin_time ? durationMinutes(openAttendance.checkin_time, now) : null;
    const duration = openAttendance.checkin_time ? durationText(openAttendance.checkin_time, now) : null;
    const { error } = await supabase
      .from("attendance")
      .update({ checkout_time: now, duration, uid })
      .eq("id", openAttendance.id);
    if (error) throw new Error(error.message);

    return { action: "out", duration, durationMinutes: minutes, logId: openAttendance.id, usedAttendanceLogs: false };
  }

  const { data: inserted, error } = await supabase
    .from("attendance")
    .insert({
      student_id: studentId,
      location,
      checkin_time: now,
      checkout_time: null,
      duration: null,
      uid,
      date,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { action: "in", duration: null, durationMinutes: null, logId: inserted?.id ?? null, usedAttendanceLogs: false };
}

async function verifyDevice(req: NextRequest, deviceId?: string | null, stationSecret?: string | null) {
  const envSecret = process.env.RFID_STATION_SECRET;
  const providedSecret = req.headers.get("x-device-key") ?? stationSecret ?? null;

  if (envSecret && providedSecret !== envSecret) {
    return false;
  }

  const deviceKey = req.headers.get("x-device-key");
  if (!deviceId || !deviceKey) return true;

  const result = await (supabase as any)
    .from("rfid_devices")
    .select("device_id")
    .eq("device_id", deviceId)
    .eq("device_key", deviceKey)
    .eq("status", "active")
    .maybeSingle();

  const missingDevicesTable = result.error?.code === "42P01" || /rfid_devices/i.test(result.error?.message ?? "");
  if (missingDevicesTable) return true;
  if (result.error) throw new Error(result.error.message);
  return Boolean(result.data);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as ScanBody;
    const uid = body.uid ? displayUid(body.uid) : "";
    const location = body.location && VALID_LOCATIONS.has(body.location) ? body.location : "school";

    if (!await verifyDevice(req, body.device_id ?? null, body.station_secret ?? null)) {
      return NextResponse.json({
        status: "error",
        code: "unauthorized",
        message: "RFID device key ไม่ถูกต้อง",
        ...oled(["ASIA-BOT RFID", "UNAUTHORIZED", "CHECK SECRET"], "error"),
      }, { status: 401 });
    }

    if (!uid) {
      return NextResponse.json({
        status: "error",
        code: "missing_uid",
        message: "ไม่พบ UID",
        ...oled(["ASIA-BOT RFID", "NO UID", "SCAN AGAIN"], "error"),
      }, { status: 400 });
    }

    const { student, cardStatus, source } = await findStudentByUid(uid);

    if (!student) {
      return NextResponse.json({
        status: "not_found",
        code: "unknown_card",
        uid,
        message: "ไม่พบบัตรนี้ในระบบ",
        ...oled(["UNKNOWN CARD", uid.slice(0, 16), "PLEASE REGISTER"], "error"),
      }, { status: 404 });
    }

    if (cardStatus !== "active") {
      return NextResponse.json({
        status: "blocked",
        code: "inactive_card",
        uid,
        student,
        message: "บัตรนี้ยังไม่พร้อมใช้งาน",
        ...oled(["CARD BLOCKED", student.student_id, student.first_name, cardStatus ?? "inactive"], "warning"),
      }, { status: 403 });
    }

    const now = new Date().toISOString();
    const date = bangkokDate();

    const session = await recordAttendanceSession({
      studentId: student.student_id,
      uid,
      location,
      now,
      date,
    });

    if (session.usedAttendanceLogs) {
      const { data: openAttendance } = await supabase
        .from("attendance")
        .select("id, checkin_time")
        .eq("student_id", student.student_id)
        .eq("location", location)
        .eq("date", date)
        .is("checkout_time", null)
        .order("checkin_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (session.action === "out" && openAttendance?.id) {
        await supabase
          .from("attendance")
          .update({ checkout_time: now, duration: session.duration, uid })
          .eq("id", openAttendance.id);
      }

      if (session.action === "in") {
        await supabase
          .from("attendance")
          .insert({
            student_id: student.student_id,
            location,
            checkin_time: now,
            checkout_time: null,
            duration: null,
            uid,
            date,
          });
      }
    }

    await supabase.from("entry_logs").insert({
      student_id: student.student_id,
      action: session.action,
      scanned_at: now,
    });

    const name = student.nickname || student.first_name;
    const action = publicAction(session.action);
    const actionLabel = action === "checkin" ? "CHECK IN" : "CHECK OUT";
    const fullName = `${student.first_name} ${student.last_name}`.trim();
    const flex = buildRfidScanFlexMessage({
      action,
      studentName: fullName,
      studentId: student.student_id,
      nickname: student.nickname,
      program: student.program,
      department: student.department,
      studentPhotoUrl: student.photo_url ?? null,
      location,
      locationLabel: LOCATION_LABEL[location],
      uid,
      scannedAt: now,
      duration: session.duration,
    });
    const nicknameText = student.nickname ? ` (${student.nickname})` : "";
    const flexAltText = `แจ้งเตือน${action === "checkin" ? "เข้า" : "ออก"}${LOCATION_LABEL[location]} ${fullName}${nicknameText} รหัส ${student.student_id}`;
    const attendanceTarget = await getLineNotificationTarget(supabase as any, "attendance");
    await Promise.allSettled([
      attendanceTarget ? sendLineFlexMessage(attendanceTarget, flexAltText, flex) : Promise.resolve(),
      student.line_user_id ? sendLineFlexMessage(student.line_user_id, flexAltText, flex) : Promise.resolve(),
    ]);

    return NextResponse.json({
      status: "ok",
      success: true,
      uid,
      card_source: source,
      attendance_log_id: session.logId,
      duration_minutes: session.durationMinutes,
      device_id: body.device_id ?? null,
      location,
      location_label: LOCATION_LABEL[location],
      action,
      legacy_action: session.action,
      name: fullName,
      nickname: student.nickname,
      student,
      scanned_at: now,
      duration: session.duration,
      ...oled([
        actionLabel,
        `${name} ${student.last_name}`.slice(0, 20),
        student.student_id,
        `${LOCATION_LABEL[location]} ${bangkokTime()}`,
      ], "success"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์";
    return NextResponse.json({
      status: "error",
      message,
      ...oled(["ASIA-BOT RFID", "SERVER ERROR", "TRY AGAIN"], "error"),
    }, { status: 500 });
  }
}
