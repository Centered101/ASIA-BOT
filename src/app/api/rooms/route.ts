import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("rooms")
      .select("*");

    if (error) {
      console.error("[api/rooms] failed:", error.message);
      return NextResponse.json({ status: "success", data: [] });
    }
    return NextResponse.json({ status: "success", data });
  } catch (error) {
    console.error("[api/rooms] failed:", error);
    return NextResponse.json({ status: "success", data: [] });
  }
}
