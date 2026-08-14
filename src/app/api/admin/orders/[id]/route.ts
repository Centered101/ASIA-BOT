import { NextResponse } from "next/server";
import { z } from "zod";
import { sendLineMessage } from "@/lib/line";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";

// Phase 1: this route had NO authentication — anyone could mark any order
// paid, cancelled, refunded, or delivered (which also pushes a LINE message to
// the student). Now gated on shop.manage_orders and audited.

const OrderPatchSchema = z.object({
  status: z.enum(["pending", "paid", "cancelled", "refunded", "delivered"]),
});

export const PATCH = withAuth<{ id: string }>(
  async (req, { params }) => {
    const parsed = await parseBody(req, OrderPatchSchema);
    if (!parsed.ok) return parsed.response;
    const { status } = parsed.data;

    const supabase = getServiceClient();

    const { data: before } = await supabase
      .from("orders")
      .select("order_id, student_id, student_name, status, total")
      .eq("order_id", params.id)
      .maybeSingle();

    if (!before) {
      return NextResponse.json({ status: "error", message: "ไม่พบคำสั่งซื้อ" }, { status: 404 });
    }

    const { error } = await supabase
      .from("orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("order_id", params.id);

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    // Notify the student when the order is ready for pickup. A LINE failure
    // must not fail the status change that already succeeded.
    if (status === "delivered" && before.student_id) {
      try {
        const { data: student } = await supabase
          .from("students")
          .select("line_user_id")
          .eq("student_id", before.student_id)
          .maybeSingle();

        if (student?.line_user_id) {
          await sendLineMessage(
            student.line_user_id,
            `🍽️ อาหารของ ${before.student_name} พร้อมแล้ว!\nสามารถมารับได้เลยครับ/ค่ะ 😊`
          );
        }
      } catch {
        /* silent — notification is best-effort */
      }
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: {
        entityId: params.id,
        before: { status: before.status },
        after: { status },
      },
    };
  },
  {
    permission: "shop.manage_orders",
    audit: { action: "order.status_change", entityType: "order" },
  }
);
