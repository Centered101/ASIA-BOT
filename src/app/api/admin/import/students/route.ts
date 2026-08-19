import { NextResponse } from "next/server";
import { z } from "zod";
import { getServiceClient } from "@/lib/server/supabase-server";
import { withAuth } from "@/lib/server/with-auth";
import { parseBody } from "@/lib/server/validation";
import { parseStudentCsv, type StudentDraft } from "@/lib/server/import-students";

/**
 * นำเข้านักเรียนจาก CSV
 *
 * ตรวจกับเขียนใช้เส้นทางเดียวกันทั้งหมด ต่างกันแค่ commit เป็น true หรือ false
 * ตั้งใจให้เป็นแบบนี้เพราะถ้าแยกโค้ดสองชุด สิ่งที่ผู้ใช้เห็นตอน preview จะค่อย ๆ
 * เพี้ยนจากสิ่งที่เขียนจริง แล้วความน่าเชื่อถือของ preview ก็หมดไป
 *
 * commit = false → บอกว่าจะเกิดอะไร ไม่แตะฐาน
 * commit = true  → เขียนเฉพาะแถวที่ผ่านทุกด่าน แถวที่ไม่ผ่านถูกข้ามและรายงาน
 *
 * ไม่มีโหมด "ทับของเดิม" โดยตั้งใจ — ดูเหตุผลใน import-students.ts
 */

const Schema = z.object({
  csv: z.string().min(1, "ยังไม่ได้ใส่ข้อมูล"),
  commit: z.boolean().default(false),
});

/** เขียนทีละก้อน ไม่ยิงพันแถวเป็น statement เดียว */
const CHUNK = 200;

type Outcome = {
  line: number;
  student_id: string;
  name: string;
  class_group: string | null;
  status: "new" | "duplicate" | "invalid";
  errors: string[];
};

export const POST = withAuth(
  async (req) => {
    const parsed = await parseBody(req, Schema);
    if (!parsed.ok) return parsed.response;
    const { csv, commit } = parsed.data;

    const result = parseStudentCsv(csv);

    if (result.missingRequired.length) {
      const th: Record<string, string> = {
        student_id: "รหัสนักเรียน", first_name: "ชื่อ",
        last_name: "นามสกุล", entry_year: "ปีที่เข้า",
      };
      return NextResponse.json({
        status: "error",
        message: `ไฟล์ขาดคอลัมน์: ${result.missingRequired.map((k) => th[k] ?? k).join(", ")}`,
        headers_found: result.headers,
      }, { status: 400 });
    }

    if (result.rows.length === 0) {
      return NextResponse.json({ status: "error", message: "ไม่มีข้อมูลในไฟล์" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ── หาห้องเรียนจากชื่อ ────────────────────────────────────────────────
    // ดึงมาทั้งหมดครั้งเดียวแทนการ query ต่อแถว ตอนนี้มี 19 กลุ่ม
    const { data: groups, error: gErr } = await supabase
      .from("class_groups")
      .select("id, name");
    if (gErr) {
      return NextResponse.json({ status: "error", message: gErr.message }, { status: 500 });
    }

    // ชื่อ → id ทั้งหมดที่ใช้ชื่อนั้น เพราะตอนนี้มีชื่อซ้ำกันอยู่จริงในฐาน
    const byName = new Map<string, string[]>();
    for (const g of groups ?? []) {
      const key = g.name.trim();
      byName.set(key, [...(byName.get(key) ?? []), g.id]);
    }

    // ── รหัสที่มีอยู่แล้วในฐาน ──────────────────────────────────────────
    const ids = result.rows.map((r) => r.draft?.student_id).filter(Boolean) as string[];
    const existing = new Set<string>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data } = await supabase
        .from("students")
        .select("student_id")
        .in("student_id", ids.slice(i, i + CHUNK));
      for (const s of data ?? []) existing.add(s.student_id);
    }

    // ── ตัดสินทีละแถว ────────────────────────────────────────────────────
    const outcomes: Outcome[] = [];
    const toInsert: (StudentDraft & { class_group_id: string | null })[] = [];

    for (const row of result.rows) {
      if (!row.draft) {
        outcomes.push({
          line: row.line, student_id: row.raw.student_id, name: row.raw.name,
          class_group: null, status: "invalid", errors: row.errors,
        });
        continue;
      }

      const d = row.draft;
      const errors = [...row.errors];
      let classGroupId: string | null = null;

      if (d.class_group_name) {
        const hits = byName.get(d.class_group_name.trim());
        if (!hits) {
          errors.push(`ไม่พบห้อง "${d.class_group_name}" ในระบบ`);
        } else if (hits.length > 1) {
          // เลือกเองไม่ได้ นักเรียนอาจไปโผล่ผิดห้องโดยไม่มีใครรู้
          errors.push(`ห้อง "${d.class_group_name}" มีซ้ำ ${hits.length} กลุ่มในระบบ แก้ชื่อให้ไม่ซ้ำก่อนนำเข้า`);
        } else {
          classGroupId = hits[0];
        }
      }

      const base = {
        line: row.line,
        student_id: d.student_id,
        name: `${d.first_name} ${d.last_name}`,
        class_group: d.class_group_name,
      };

      if (errors.length) {
        outcomes.push({ ...base, status: "invalid", errors });
      } else if (existing.has(d.student_id)) {
        outcomes.push({ ...base, status: "duplicate", errors: ["มีรหัสนี้ในระบบแล้ว จึงข้ามไป"] });
      } else {
        outcomes.push({ ...base, status: "new", errors: [] });
        toInsert.push({ ...d, class_group_id: classGroupId });
      }
    }

    const summary = {
      total: outcomes.length,
      new: outcomes.filter((o) => o.status === "new").length,
      duplicate: outcomes.filter((o) => o.status === "duplicate").length,
      invalid: outcomes.filter((o) => o.status === "invalid").length,
    };

    if (!commit) {
      return NextResponse.json({ status: "success", committed: false, summary, outcomes });
    }

    // ── เขียนจริง ────────────────────────────────────────────────────────
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const batch = toInsert.slice(i, i + CHUNK).map((d) => ({
        student_id: d.student_id,
        first_name: d.first_name,
        last_name: d.last_name,
        nickname: d.nickname,
        program: d.program,
        department: d.department,
        entry_year: d.entry_year,
        student_phone: d.student_phone,
        gender: d.gender,
        birth_date: d.birth_date,
        class_group_id: d.class_group_id,
        card_status: "active" as const,
      }));

      const { error, count } = await supabase
        .from("students")
        .insert(batch, { count: "exact" });

      if (error) {
        // บอกว่าเขียนไปแล้วเท่าไหร่ ไม่ใช่แค่ "ล้มเหลว" — ผู้ใช้ต้องรู้ว่า
        // ต้องนำเข้าซ้ำทั้งไฟล์หรือแค่ส่วนที่เหลือ (นำเข้าซ้ำปลอดภัยอยู่แล้ว
        // เพราะรหัสที่เข้าไปแล้วจะถูกนับเป็น duplicate)
        return NextResponse.json({
          status: "error",
          message: `บันทึกได้ ${inserted} คนแล้วเกิดข้อผิดพลาด: ${error.message}`,
          summary: { ...summary, inserted },
        }, { status: 500 });
      }
      inserted += count ?? batch.length;
    }

    return {
      response: NextResponse.json({
        status: "success",
        committed: true,
        summary: { ...summary, inserted },
        outcomes,
      }),
      audit: {
        after: {
          inserted,
          skipped_duplicate: summary.duplicate,
          skipped_invalid: summary.invalid,
          student_ids: toInsert.map((d) => d.student_id),
        },
      },
    };
  },
  {
    permission: "student.create",
    audit: { action: "student.import", entityType: "student" },
  }
);
