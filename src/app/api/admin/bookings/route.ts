import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseBookingParticipants(purpose: string | null | undefined) {
  const text = purpose ?? "";
  const marker = "ผู้เข้าร่วม:";
  const idx = text.indexOf(marker);
  if (idx === -1) return { cleanPurpose: text, participantIds: [] as string[] };

  const cleanPurpose = text.slice(0, idx).trim();
  const participantLine = text.slice(idx + marker.length).split("\n")[0] ?? "";
  const participantIds = participantLine
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean);

  return { cleanPurpose, participantIds: [...new Set(participantIds)] };
}

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status");

  const [bookingsRes, roomsRes, slotsRes] = await Promise.all([
    (() => {
      let q = supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (statusFilter && statusFilter !== "all") {
        q = q.eq("status", statusFilter as "pending" | "approved" | "rejected" | "cancelled");
      }
      return q;
    })(),
    supabase.from("rooms").select("id, name, location"),
    supabase.from("time_slots").select("id, label, start_time, end_time"),
  ]);

  if (bookingsRes.error) return NextResponse.json({ status: "error", message: bookingsRes.error.message }, { status: 500 });

  const roomMap = Object.fromEntries((roomsRes.data ?? []).map((r) => [r.id, r]));
  const slotMap = Object.fromEntries((slotsRes.data ?? []).map((s) => [s.id, s]));
  const participantByBooking = Object.fromEntries(
    (bookingsRes.data ?? []).map((b) => [b.id, parseBookingParticipants(b.purpose)])
  );
  const studentIds = [
    ...new Set((bookingsRes.data ?? []).flatMap((b) => [
      b.student_id,
      ...(participantByBooking[b.id]?.participantIds ?? []),
    ]).filter(Boolean)),
  ];
  const studentsRes = studentIds.length
    ? await (supabase as any).from("students").select("student_id, first_name, last_name, nickname, program, department, photo_url").in("student_id", studentIds)
    : { data: [] };
  const studentMap = Object.fromEntries((studentsRes.data ?? []).map((s: any) => [s.student_id, s]));

  const data = (bookingsRes.data ?? []).map((b) => {
    const parsed = participantByBooking[b.id] ?? { cleanPurpose: b.purpose, participantIds: [] };
    return {
      ...b,
      purpose_clean: parsed.cleanPurpose || b.purpose,
      room_name: roomMap[b.room_id]?.name ?? "ไม่ทราบ",
      room_location: roomMap[b.room_id]?.location ?? "",
      slot_label: slotMap[b.slot_id]?.label ?? "",
      slot_start: slotMap[b.slot_id]?.start_time ?? "",
      slot_end: slotMap[b.slot_id]?.end_time ?? "",
      student_photo_url: studentMap[b.student_id]?.photo_url ?? null,
      student_nickname: studentMap[b.student_id]?.nickname ?? null,
      student_program: studentMap[b.student_id]?.program ?? null,
      student_department: studentMap[b.student_id]?.department ?? null,
      participants: parsed.participantIds.map((studentId) => {
        const s = studentMap[studentId];
        return {
          student_id: studentId,
          name: s ? `${s.first_name} ${s.last_name}` : studentId,
          nickname: s?.nickname ?? null,
          program: s?.program ?? null,
          department: s?.department ?? null,
          photo_url: s?.photo_url ?? null,
        };
      }),
    };
  });

  return NextResponse.json({ status: "success", data });
}
