/**
 * อ่าน CSV — เขียนเองแทนการลง dependency
 *
 * ที่ไม่ลง papaparse หรือ SheetJS เพราะไฟล์ที่ต้องรับคือ CSV ที่ Excel เซฟออกมา
 * ซึ่งใช้กติกาเดียว (RFC 4180) และโค้ดที่ต้องเขียนสั้นกว่าการดูแล dependency
 * ที่มีผิวสัมผัสกว้างกว่าที่เราใช้จริงมาก ส่วน .xlsx ตั้งใจไม่รองรับรอบนี้ —
 * ให้ผู้ใช้ "Save As → CSV UTF-8" ซึ่งเป็นขั้นตอนเดียวและเห็นผลทันทีว่าถูกไหม
 *
 * รองรับสิ่งที่ Excel ทำจริงและทำให้ parser ง่าย ๆ พัง:
 *   - ฟิลด์ในเครื่องหมายคำพูดที่มีคอมมา ขึ้นบรรทัดใหม่ หรือคำพูดซ้อน ("")
 *   - BOM หัวไฟล์ (Excel ใส่ให้เสมอเมื่อเลือก UTF-8) ถ้าไม่ตัดทิ้ง ชื่อคอลัมน์
 *     แรกจะกลายเป็น "﻿student_id" แล้วหาไม่เจอทั้งที่ตาเห็นว่าตรง
 *   - ปิดท้ายด้วย CRLF หรือ LF ก็ได้
 */

/** แยก CSV เป็นตารางดิบ ยังไม่ตีความหัวตาราง */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  const endField = () => { row.push(field); field = ""; };
  const endRow = () => {
    endField();
    // แถวที่มีช่องเดียวและว่าง = บรรทัดว่าง ไม่ใช่ข้อมูล
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        // "" ข้างในคำพูด = อักขระคำพูดหนึ่งตัว ไม่ใช่การปิด
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i++; continue;
      }
      field += c; i++; continue;
    }

    if (c === '"') { quoted = true; i++; continue; }
    if (c === ",") { endField(); i++; continue; }
    if (c === "\r") { i++; continue; }          // CRLF — ให้ \n เป็นตัวจบแถว
    if (c === "\n") { endRow(); i++; continue; }
    field += c; i++;
  }

  // ไฟล์ที่ไม่ลงท้ายด้วยบรรทัดใหม่ยังมีแถวสุดท้ายค้างอยู่
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

export type CsvTable = {
  headers: string[];
  /** แถวข้อมูล จับคู่หัวตารางแล้ว — คีย์คือหัวตารางที่ normalize แล้ว */
  rows: Record<string, string>[];
};

/**
 * ชื่อคอลัมน์ให้เทียบแบบหลวม เพราะไฟล์จริงมีทั้งช่องว่างหน้าหลัง ตัวพิมพ์ใหญ่
 * และขีดล่างสลับขีดกลาง คนกรอกไม่ควรต้องมาแก้หัวตารางให้ตรงเป๊ะ
 */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** แปลงตารางดิบเป็นแถวที่อ้างด้วยชื่อคอลัมน์ */
export function toTable(rows: string[][]): CsvTable {
  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map(normalizeHeader);
  const out: Record<string, string>[] = [];

  for (const raw of rows.slice(1)) {
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => { rec[h] = (raw[idx] ?? "").trim(); });
    // ข้ามแถวที่ทุกช่องว่าง — Excel มักทิ้งแถวว่างท้ายไฟล์ไว้
    if (Object.values(rec).some((v) => v !== "")) out.push(rec);
  }

  return { headers, rows: out };
}

export function readCsv(input: string): CsvTable {
  return toTable(parseCsv(input));
}
