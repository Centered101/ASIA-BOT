import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";

// Phase 1: this route had NO authentication at all — anyone on the internet
// could POST and create a product in the school shop. Now gated on
// shop.manage_products and audited.

const ProductCreateSchema = z.object({
  name: z.string().trim().min(1, "ต้องระบุชื่อสินค้า"),
  price: z.number().nonnegative("ราคาต้องไม่ติดลบ"),
  cost: z.number().nonnegative().nullable().optional(),
  stock: z.number().int().nonnegative().optional(),
  unit: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tag: z.string().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  colors: z.array(z.string()).nullable().optional(),
  color_stock: z.record(z.string(), z.number()).nullable().optional(),
  active: z.boolean().optional(),
});

export const GET = withAuth(
  async () => {
    const { data, error } = await getServiceClient()
      .from("products")
      .select("id, tag, stock, name, price, cost, images, unit, category, colors, color_stock, active, deleted_at, created_at")
      .order("name");

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ status: "success", data });
  },
  { permission: "shop.view_products" }
);

export const POST = withAuth(
  async (req) => {
    const parsed = await parseBody(req, ProductCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const { data, error } = await getServiceClient()
      .from("products")
      .insert({
        name: body.name,
        price: body.price,
        cost: body.cost ?? null,
        stock: body.stock ?? 0,
        unit: body.unit ?? null,
        category: body.category ?? null,
        tag: body.tag ?? null,
        images: body.images ?? null,
        colors: body.colors?.length ? body.colors : null,
        color_stock:
          body.color_stock && Object.keys(body.color_stock).length ? body.color_stock : null,
        active: body.active ?? true,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success", id: data.id }),
      audit: { entityId: data.id, after: { ...body } },
    };
  },
  {
    permission: "shop.manage_products",
    audit: { action: "product.create", entityType: "product" },
  }
);
