import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkAdminAuth, hasAdminRole } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await checkAdminAuth(req);
  if (!session) return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  if (!hasAdminRole(session, ["superadmin"]))
    return NextResponse.json({ status: "error", message: "เฉพาะ Superadmin เท่านั้น" }, { status: 403 });

  const { action, admin_note, password, use_desired_password } = await req.json();
  if (action !== "approve" && action !== "reject" && action !== "review")
    return NextResponse.json({ status: "error", message: "action ไม่ถูกต้อง" }, { status: 400 });

  const { data: app, error: fetchErr } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !app)
    return NextResponse.json({ status: "error", message: "ไม่พบใบสมัคร" }, { status: 404 });
  if (app.status === "approved" || app.status === "active")
    return NextResponse.json({ status: "error", message: "อนุมัติไปแล้ว" }, { status: 400 });

  // ── Approve ─────────────────────────────────────────────────────────────────
  if (action === "approve") {
    const usingDesired = use_desired_password && !!app.desired_password_hash;
    if (!usingDesired && (!password || password.length < 6))
      return NextResponse.json({ status: "error", message: "กรุณากำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร" }, { status: 400 });

    const { data: existingAdmin } = await (supabase.from("admins") as any)
      .select("admin_id")
      .eq("username", app.desired_username)
      .maybeSingle();
    if (existingAdmin)
      return NextResponse.json({ status: "error", message: `username "${app.desired_username}" มีอยู่ในระบบแล้ว` }, { status: 409 });

    const password_hash = usingDesired
      ? app.desired_password_hash
      : await bcrypt.hash(password, 12);
    const newAdminId = `ADM-${Date.now()}`;

    // ตรวจว่า email นี้มี admin อื่น google_email ซ้ำอยู่ไหม
    let googleEmail: string | null = app.email ?? null;
    if (googleEmail) {
      const { data: emailConflict } = await (supabase.from("admins") as any)
        .select("admin_id")
        .eq("google_email", googleEmail)
        .maybeSingle();
      if (emailConflict) googleEmail = null;
    }

    const { error: createErr } = await (supabase.from("admins") as any).insert({
      admin_id:     newAdminId,
      username:     app.desired_username,
      password_hash,
      role:         "admin",
      admin_status: "active",
      first_name:   app.full_name?.split(" ")[0] ?? null,
      last_name:    app.full_name?.split(" ").slice(1).join(" ") || null,
      email:        app.email ?? null,
      phone:        app.phone ?? null,
      department:   app.department ?? null,
      google_email: googleEmail,
    });

    if (createErr)
      return NextResponse.json({ status: "error", message: `สร้างบัญชีไม่สำเร็จ: ${createErr.message}` }, { status: 500 });

    // อัปเดตสถานะครูเป็น active + เก็บ linked_admin_id
    await supabase.from("teachers").update({
      status:           "active",
      linked_admin_id:  newAdminId,
      admin_note:       admin_note?.trim() || null,
      reviewed_by:      session.admin_id,
      reviewed_at:      new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ status: "success", admin_id: newAdminId, username: app.desired_username });
  }

  // ── Reject ───────────────────────────────────────────────────────────────────
  if (action === "reject") {
    if (!admin_note?.trim())
      return NextResponse.json({ status: "error", message: "กรุณาระบุเหตุผลที่ไม่อนุมัติ" }, { status: 400 });

    await supabase.from("teachers").update({
      status:      "rejected",
      admin_note:  admin_note.trim(),
      reviewed_by: session.admin_id,
      reviewed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ status: "success" });
  }

  // ── Mark reviewing ───────────────────────────────────────────────────────────
  await supabase.from("teachers").update({
    status:      "reviewing",
    reviewed_by: session.admin_id,
    updated_at:  new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ status: "success" });
}
