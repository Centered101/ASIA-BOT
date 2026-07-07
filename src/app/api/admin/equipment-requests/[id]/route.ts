import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_STATUS = ["pending", "approved", "picked_up", "rejected", "cancelled", "returned"] as const;
type Status = typeof ALLOWED_STATUS[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin", "admin", "staff"])) {
    return NextResponse.json({ status: "error", message: "ไม่มีสิทธิ์" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { status?: Status; admin_note?: string | null };

  if (!body.status || !ALLOWED_STATUS.includes(body.status)) {
    return NextResponse.json({ status: "error", message: "สถานะไม่ถูกต้อง" }, { status: 400 });
  }

  const { data: current, error: currentError } = await supabase
    .from("equipment_requests")
    .select("id, status, quantity, equipment_item_id")
    .eq("id", id)
    .single();
  if (currentError || !current) {
    return NextResponse.json({ status: "error", message: currentError?.message ?? "ไม่พบคำขอ" }, { status: 404 });
  }

  const nextStatus = body.status;
  const prevStatus = current.status;

  // ป้องกันการเปลี่ยนสถานะที่ไม่สมเหตุสมผล (เช่น กดรับคืนคำขอที่ยังไม่อนุมัติ)
  const validTransitions: Record<Status, Status[]> = {
    pending: ["approved", "rejected", "cancelled"],
    approved: ["picked_up", "cancelled"],
    picked_up: ["returned"],
    rejected: [],
    cancelled: [],
    returned: [],
  };
  if (prevStatus !== nextStatus && !validTransitions[prevStatus]?.includes(nextStatus)) {
    return NextResponse.json({ status: "error", message: `ไม่สามารถเปลี่ยนสถานะจาก ${prevStatus} เป็น ${nextStatus} ได้` }, { status: 400 });
  }

  if (prevStatus === "pending" && nextStatus === "approved") {
    const { data: item, error: itemError } = await supabase
      .from("equipment_items")
      .select("available_quantity")
      .eq("id", current.equipment_item_id)
      .single();
    if (itemError || !item) return NextResponse.json({ status: "error", message: "ไม่พบคุรุภัณฑ์" }, { status: 404 });
    if (item.available_quantity < current.quantity) {
      return NextResponse.json({ status: "error", message: `คุรุภัณฑ์คงเหลือไม่พอ (เหลือ ${item.available_quantity})` }, { status: 409 });
    }
    const { error: decError } = await supabase
      .from("equipment_items")
      .update({ available_quantity: item.available_quantity - current.quantity, updated_at: new Date().toISOString() })
      .eq("id", current.equipment_item_id);
    if (decError) return NextResponse.json({ status: "error", message: decError.message }, { status: 500 });
  } else if ((prevStatus === "approved" && nextStatus === "cancelled") || (prevStatus === "picked_up" && nextStatus === "returned")) {
    const { data: item, error: itemError } = await supabase
      .from("equipment_items")
      .select("available_quantity")
      .eq("id", current.equipment_item_id)
      .single();
    if (itemError || !item) return NextResponse.json({ status: "error", message: "ไม่พบคุรุภัณฑ์" }, { status: 404 });
    const { error: incError } = await supabase
      .from("equipment_items")
      .update({ available_quantity: item.available_quantity + current.quantity, updated_at: new Date().toISOString() })
      .eq("id", current.equipment_item_id);
    if (incError) return NextResponse.json({ status: "error", message: incError.message }, { status: 500 });
  }

  const update: Database["public"]["Tables"]["equipment_requests"]["Update"] = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if ("admin_note" in body) update.admin_note = body.admin_note ?? null;
  if (nextStatus === "approved" || nextStatus === "rejected") {
    update.reviewed_by = session.admin_id;
    update.reviewed_at = new Date().toISOString();
  }
  if (nextStatus === "picked_up") {
    update.picked_up_at = new Date().toISOString();
  }
  if (nextStatus === "returned") {
    update.returned_at = new Date().toISOString();
  }

  const { error } = await supabase.from("equipment_requests").update(update).eq("id", id);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  return NextResponse.json({ status: "success" });
}
