import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeUid(uid: string) {
  return uid.trim().replace(/[\s:-]/g, "").toUpperCase();
}
function colonUid(uid: string) {
  const normalized = normalizeUid(uid);
  return normalized.match(/.{1,2}/g)?.join(":") ?? normalized;
}
function uidCandidates(uid: string) {
  const raw = uid.trim().replace(/\s/g, "").toUpperCase();
  const compact = normalizeUid(uid);
  return Array.from(new Set([raw, compact, colonUid(uid)]));
}

async function findStudentIdByUid(uid: string): Promise<string | null> {
  const candidates = uidCandidates(uid);

  const rfidCard = await (supabase as any)
    .from("rfid_cards")
    .select("student_id")
    .in("uid", candidates)
    .maybeSingle();
  if (!rfidCard.error && rfidCard.data) return rfidCard.data.student_id as string;

  const studentCard = await (supabase as any)
    .from("student_cards")
    .select("student_id")
    .in("uid", candidates)
    .maybeSingle();
  if (!studentCard.error && studentCard.data) return studentCard.data.student_id as string;

  const { data: student } = await (supabase as any)
    .from("students")
    .select("student_id")
    .in("uid", candidates)
    .maybeSingle();
  return (student as { student_id: string } | null)?.student_id ?? null;
}

export async function POST(req: NextRequest) {
  const admin = await checkAdminAuth(req);
  if (!admin) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { uid?: string; action?: "pickup" | "return" };
  const uid = body.uid?.trim();
  const action = body.action;

  if (!uid) return NextResponse.json({ status: "error", message: "ไม่พบ UID" }, { status: 400 });
  if (action !== "pickup" && action !== "return") {
    return NextResponse.json({ status: "error", message: "action ต้องเป็น pickup หรือ return" }, { status: 400 });
  }

  const studentId = await findStudentIdByUid(uid);
  if (!studentId) {
    return NextResponse.json({ status: "error", message: "ไม่พบบัตรนี้ในระบบ" }, { status: 404 });
  }

  const { data: student } = await supabase
    .from("students")
    .select("first_name, last_name, nickname")
    .eq("student_id", studentId)
    .maybeSingle();
  const studentLabel = student ? `${student.nickname || student.first_name} ${student.last_name}`.trim() : studentId;

  const targetStatus = action === "pickup" ? "approved" : "picked_up";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidate, error: findError } = await (supabase as any)
    .from("equipment_requests")
    .select("id, quantity, equipment_item_id, equipment_items(name, unit)")
    .eq("student_id", studentId)
    .eq("status", targetStatus)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (findError) return NextResponse.json({ status: "error", message: findError.message }, { status: 500 });
  if (!candidate) {
    return NextResponse.json({
      status: "error",
      message: action === "pickup"
        ? `${studentLabel} ไม่มีคำขอที่อนุมัติแล้วรอรับของ`
        : `${studentLabel} ไม่มีคุรุภัณฑ์ที่รับไปแล้วรอคืน`,
    }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (action === "pickup") {
    const { error } = await supabase
      .from("equipment_requests")
      .update({ status: "picked_up", picked_up_at: now, updated_at: now })
      .eq("id", candidate.id);
    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  } else {
    const { error } = await supabase
      .from("equipment_requests")
      .update({ status: "returned", returned_at: now, updated_at: now })
      .eq("id", candidate.id);
    if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

    const { data: item } = await supabase
      .from("equipment_items")
      .select("available_quantity")
      .eq("id", candidate.equipment_item_id)
      .single();
    if (item) {
      await supabase
        .from("equipment_items")
        .update({ available_quantity: item.available_quantity + candidate.quantity, updated_at: now })
        .eq("id", candidate.equipment_item_id);
    }
  }

  const itemName = (candidate as any).equipment_items?.name ?? "คุรุภัณฑ์";
  return NextResponse.json({
    status: "success",
    message: action === "pickup"
      ? `ยืนยันรับของสำเร็จ: ${studentLabel} รับ "${itemName}"`
      : `ยืนยันคืนของสำเร็จ: ${studentLabel} คืน "${itemName}"`,
  });
}
