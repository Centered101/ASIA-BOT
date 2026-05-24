import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { checkAdminAuth } from "@/lib/admin-auth";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (!await checkAdminAuth(req)) return NextResponse.json({ status: "error" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status");

  let query = supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (typeFilter && typeFilter !== "all") query = query.eq("type", typeFilter as "comment" | "report");
  if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter as "pending" | "in_progress" | "resolved");

  const { data, error } = await query;
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  return NextResponse.json({ status: "success", data });
}
