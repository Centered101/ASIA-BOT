import { NextResponse } from "next/server";
import { z } from "zod";
import { buildStorageImagePath } from "@/lib/storage-path";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";

// Phase 1: both handlers had NO authentication. Anyone could upload arbitrary
// files into the public `product-images` bucket, and DELETE could remove any
// file in it given only its URL. Both now require shop.manage_products.
//
// NOTE for a later phase: `svg` stays in ALLOWED because storage.sql permits
// image/svg+xml in this bucket and existing products may rely on it. An SVG
// fetched directly from the public bucket URL bypasses the CSP that
// next.config.ts applies to next/image, so this is worth revisiting once the
// existing assets have been checked.

const ALLOWED = ["jpg", "jpeg", "png", "webp", "gif", "svg", "ico"];
const CONTENT_TYPES: Record<string, string> = { svg: "image/svg+xml", ico: "image/x-icon" };
const BUCKET = "product-images";

const DeleteSchema = z.object({ url: z.string().min(1, "ไม่พบ URL") });

export const POST = withAuth(
  async (req) => {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ status: "error", message: "ไม่พบไฟล์" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json(
        { status: "error", message: "ไฟล์ต้องเป็น jpg, png, webp, gif, svg หรือ ico" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();
    const contentType = CONTENT_TYPES[ext] ?? file.type;
    const path = buildStorageImagePath({ fileName: file.name, ext });
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: false });

    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return {
      response: NextResponse.json({ status: "success", url: publicUrl }),
      audit: { entityId: path, after: { path, contentType, size: file.size } },
    };
  },
  {
    permission: "shop.manage_products",
    audit: { action: "product_image.upload", entityType: "storage_object" },
  }
);

export const DELETE = withAuth(
  async (req) => {
    const parsed = await parseBody(req, DeleteSchema);
    if (!parsed.ok) return parsed.response;

    const marker = `/object/public/${BUCKET}/`;
    const idx = parsed.data.url.indexOf(marker);
    if (idx === -1) {
      return NextResponse.json(
        { status: "error", message: `URL ไม่ใช่ไฟล์ใน ${BUCKET}` },
        { status: 400 }
      );
    }

    const path = decodeURIComponent(parsed.data.url.slice(idx + marker.length));
    const { error } = await getServiceClient().storage.from(BUCKET).remove([path]);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: path, before: { path } },
    };
  },
  {
    permission: "shop.manage_products",
    audit: { action: "product_image.delete", entityType: "storage_object" },
  }
);
