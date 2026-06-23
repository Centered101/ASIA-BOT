import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin"]))
    return NextResponse.json({ status: "error", message: "เฉพาะ Superadmin เท่านั้น" }, { status: 403 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "pending";

  const query = supabase
    .from("teachers")
    .select("id, full_name, email, phone, department, subject, reason, desired_username, status, admin_note, reviewed_by, reviewed_at, linked_admin_id, created_at")
    .order("created_at", { ascending: true });

  if (statusParam === "pending") {
    query.in("status", ["pending", "reviewing"]);
  } else if (statusParam !== "all") {
    query.eq("status", statusParam);
  } else {
    // all = เฉพาะสถานะที่เกี่ยวกับใบสมัคร (ไม่รวม active/inactive ที่เพิ่มโดย admin)
    query.in("status", ["pending", "reviewing", "approved", "rejected"]).not("reason", "is", null);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data: data ?? [] });
}
