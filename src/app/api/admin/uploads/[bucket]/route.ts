import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { buildStorageImagePath } from "@/lib/storage-path";
import { hasPermission } from "@/lib/rbac/definitions";

/**
 * อัปโหลดรูปแบบรวมศูนย์ — bucket มาจาก URL แต่ต้องอยู่ใน allowlist เท่านั้น
 *
 * ของเดิมมี route อัปโหลด 6 ตัวที่เกือบเหมือนกันทุกบรรทัด และ
 * /api/admin/upload hardcode bucket เป็น product-images โมดูลแจ้งซ่อมต้องการ
 * รูป 3 ระยะกับรูปครุภัณฑ์ ถ้าไม่รวบตอนนี้จะกลายเป็นตัวที่ 7 และ 8
 *
 * ตั้งใจไม่แตะ 6 ตัวเดิม — การย้ายของเดิมมาที่นี่เป็น refactor ที่ต้องไล่
 * ทดสอบทุกหน้าที่เรียกใช้ ซึ่งเป็นงานแยก ของใหม่ใช้ตัวนี้
 *
 * bucket มาจาก path parameter จึงต้องมี allowlist ปิดตาย ไม่งั้นใครก็เขียน
 * ไฟล์ลง bucket ไหนก็ได้ที่โปรเจกต์มี รวมถึงที่เก็บรูปนักเรียน
 */

const BUCKETS = {
  "maintenance-photos": {
    permission: "maintenance.create",
    // ไม่รับ svg: bucket นี้รับรูปจากผู้ใช้ทั่วไป และ svg ที่เปิดตรงจาก
    // public URL จะข้าม CSP ของ next/image ไปได้
    ext: ["jpg", "jpeg", "png", "webp"],
  },
  "asset-images": {
    permission: "asset.manage",
    ext: ["jpg", "jpeg", "png", "webp"],
  },
} as const;

type BucketName = keyof typeof BUCKETS;

function isBucket(v: string): v is BucketName {
  return Object.prototype.hasOwnProperty.call(BUCKETS, v);
}

export const POST = withAuth<{ bucket: string }>(
  async (req, { params, principal }) => {
    const bucket = params.bucket;
    if (!isBucket(bucket)) {
      return NextResponse.json(
        { status: "error", message: "ไม่รู้จัก bucket นี้" },
        { status: 404 }
      );
    }

    const spec = BUCKETS[bucket];
    // สิทธิ์ต่างกันต่อ bucket — ใครก็แนบรูปแจ้งซ่อมได้ แต่รูปทะเบียนครุภัณฑ์
    // ต้องเป็นฝ่ายพัสดุ withAuth ตรวจแค่ว่าล็อกอินแล้ว ที่เหลือตรวจตรงนี้
    if (!hasPermission(principal.permissions, spec.permission)) {
      return NextResponse.json(
        { status: "error", message: "ไม่มีสิทธิ์อัปโหลดไปยังที่เก็บนี้" },
        { status: 403 }
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ status: "error", message: "ไม่พบไฟล์" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!(spec.ext as readonly string[]).includes(ext)) {
      return NextResponse.json(
        { status: "error", message: `ไฟล์ต้องเป็น ${spec.ext.join(", ")}` },
        { status: 400 }
      );
    }

    const folder = form.get("folder");
    const path = buildStorageImagePath({
      fileName: file.name,
      ext,
      folder: typeof folder === "string" ? folder : null,
    });

    const supabase = getServiceClient();
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error(`[uploads/${bucket}]`, error.message, "| path:", path);
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ status: "success", url: publicUrl, path });
  },
  { permission: "school.info" }
);

export const DELETE = withAuth<{ bucket: string }>(
  async (req, { params, principal }) => {
    const bucket = params.bucket;
    if (!isBucket(bucket)) {
      return NextResponse.json(
        { status: "error", message: "ไม่รู้จัก bucket นี้" },
        { status: 404 }
      );
    }

    const spec = BUCKETS[bucket];
    // ลบต้องใช้สิทธิ์สูงกว่าอัปโหลดเสมอ ไม่งั้นนักเรียนที่แนบรูปแจ้งซ่อมได้
    // จะลบรูปหลักฐานของงานซ่อมคนอื่นได้ด้วย
    const deletePermission =
      bucket === "maintenance-photos" ? "maintenance.update" : spec.permission;
    if (!hasPermission(principal.permissions, deletePermission)) {
      return NextResponse.json(
        { status: "error", message: "ไม่มีสิทธิ์ลบไฟล์ในที่เก็บนี้" },
        { status: 403 }
      );
    }

    const url = new URL(req.url).searchParams.get("url");
    if (!url) {
      return NextResponse.json({ status: "error", message: "ต้องระบุ url" }, { status: 400 });
    }

    // ตัด path จาก public URL และยืนยันว่าอยู่ใน bucket ที่ระบุจริง
    // กันการส่ง URL ของ bucket อื่นเข้ามาลบข้าม
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) {
      return NextResponse.json(
        { status: "error", message: `URL ไม่ใช่ไฟล์ใน ${bucket}` },
        { status: 400 }
      );
    }

    const path = decodeURIComponent(url.slice(idx + marker.length));
    const { error } = await getServiceClient().storage.from(bucket).remove([path]);
    if (error) {
      return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
    }

    return {
      response: NextResponse.json({ status: "success" }),
      audit: { entityId: path, before: { bucket, url } },
    };
  },
  {
    permission: "school.info",
    audit: { action: "upload.delete", entityType: "storage_object" },
  }
);
