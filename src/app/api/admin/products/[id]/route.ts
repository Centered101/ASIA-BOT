import { NextResponse } from "next/server";
import { z } from "zod";
import type { Database } from "@/types/database";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";

// Phase 1: PATCH and DELETE had NO authentication — anyone could edit prices
// and stock, or soft-delete products. Now gated on shop.manage_products, and
// audited with the previous row so a bad change can be traced and reversed.

type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

const ProductPatchSchema = z
  .object({
    name: z.string().trim().min(1),
    price: z.number().nonnegative(),
    cost: z.number().nonnegative().nullable(),
    stock: z.number().int().nonnegative(),
    unit: z.string().nullable(),
    category: z.string().nullable(),
    tag: z.string().nullable(),
    images: z.array(z.string()).nullable(),
    colors: z.array(z.string()).nullable(),
    color_stock: z.record(z.string(), z.number()).nullable(),
    active: z.boolean(),
    deleted_at: z.string().nullable(),
  })
  .partial();

const SELECT_COLS =
  "id, tag, stock, name, price, cost, images, unit, category, colors, color_stock, active, deleted_at";

export const PATCH = withAuth<{ id: string }>(
  async (req, { params }) => {
    const parsed = await parseBody(req, ProductPatchSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // Only touch keys the caller actually sent — an absent key must not be
    // read as "set to null", which is why this mirrors the original `in` checks.
    const update: ProductUpdate = {};
    if ("name" in body) update.name = body.name;
    if ("price" in body) update.price = body.price;
    if ("cost" in body) update.cost = body.cost;
    if ("stock" in body) update.stock = body.stock;
    if ("unit" in body) update.unit = body.unit;
    if ("category" in body) update.category = body.category;
    if ("tag" in body) update.tag = body.tag;
    if ("images" in body) update.images = body.images;
    if ("colors" in body) update.colors = body.colors?.length ? body.colors : null;
    if ("color_stock" in body) {
      update.color_stock =
        body.color_stock && Object.keys(body.color_stock).length ? body.color_stock : null;
    }
    if ("active" in body) update.active = body.active;
    if ("deleted_at" in body) update.deleted_at = body.deleted_at;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลให้อัพเดท" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data: before } = await supabase
      .from("products")
      .select(SELECT_COLS)
      .eq("id", params.id)
      .maybeSingle();

    const { data: after, error } = await supabase
      .from("products")
      .update(update)
      .eq("id", params.id)
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    if (!after) {
      return NextResponse.json({ status: "error", message: "ไม่พบสินค้า" }, { status: 404 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: params.id, before, after },
    };
  },
  {
    permission: "shop.manage_products",
    audit: { action: "product.update", entityType: "product" },
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (_req, { params }) => {
    const supabase = getServiceClient();

    const { data: before } = await supabase
      .from("products")
      .select(SELECT_COLS)
      .eq("id", params.id)
      .maybeSingle();

    // Soft delete, as before — product history stays intact for past orders.
    const { data: after, error } = await supabase
      .from("products")
      .update({ active: false, stock: 0, deleted_at: new Date().toISOString() })
      .eq("id", params.id)
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    if (!after) {
      return NextResponse.json({ status: "error", message: "ไม่พบสินค้า" }, { status: 404 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: params.id, before, after },
    };
  },
  {
    permission: "shop.manage_products",
    audit: { action: "product.delete", entityType: "product" },
  }
);
