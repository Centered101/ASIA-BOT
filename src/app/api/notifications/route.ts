import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";

// กล่องแจ้งเตือนของคนที่ล็อกอินอยู่
//
// ไม่มี permission gate เพราะทุกคนที่ล็อกอินได้ควรเห็นกล่องของตัวเอง
// ความปลอดภัยมาจากการที่ทุก query ผูกกับ principal.accountId เสมอ
// ไม่เคยรับ account_id จาก client

const PAGE_SIZE = 30;

export const GET = withAuth(async (req, { principal }) => {
  // ผู้ใช้ที่ยังไม่ได้ผูก account (เช่นล็อกอินผ่าน legacy header) ไม่มีกล่อง
  // คืนกล่องว่างแทน 4xx เพราะกระดิ่งอยู่บนทุกหน้า ไม่ควรทำหน้าพัง
  if (!principal.accountId) {
    return NextResponse.json({ status: "success", data: [], unread: 0 });
  }

  const url = new URL(req.url);
  const onlyUnread = url.searchParams.get("unread") === "1";
  const before = url.searchParams.get("before");

  const supabase = getServiceClient();

  let query = supabase
    .from("notifications")
    .select("id, category_key, title, body, link, entity_type, entity_id, priority, read_at, created_at")
    .eq("account_id", principal.accountId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (onlyUnread) query = query.is("read_at", null);
  // เลื่อนหน้าด้วย created_at ไม่ใช่ offset เพราะแถวใหม่แทรกด้านบนตลอดเวลา
  // ถ้าใช้ offset จะเห็นรายการซ้ำตอนมีแจ้งเตือนเข้ามาระหว่างเลื่อน
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("account_id", principal.accountId)
    .is("read_at", null);

  return NextResponse.json({
    status: "success",
    data: data ?? [],
    unread: count ?? 0,
    has_more: (data?.length ?? 0) === PAGE_SIZE,
  });
});

const MarkSchema = z.object({
  // ไม่ส่ง ids = อ่านทั้งหมด ส่ง ids = อ่านเฉพาะที่ระบุ
  ids: z.array(z.string().uuid()).max(100).optional(),
});

export const PATCH = withAuth(async (req, { principal }) => {
  if (!principal.accountId) {
    return NextResponse.json({ status: "success", updated: 0 });
  }

  const parsed = await parseBody(req, MarkSchema);
  if (!parsed.ok) return parsed.response;

  const supabase = getServiceClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("notifications")
    .update({ read_at: now })
    // ผูกกับเจ้าของเสมอ ต่อให้ client ส่ง id ของคนอื่นมาก็ไม่โดน
    .eq("account_id", principal.accountId)
    .is("read_at", null);

  if (parsed.data.ids?.length) query = query.in("id", parsed.data.ids);

  // นับจากแถวที่คืนกลับมา — .update() รับ option ตัวนับไม่ได้เหมือน .select()
  const { data, error } = await query.select("id");
  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ status: "success", updated: data?.length ?? 0 });
});
