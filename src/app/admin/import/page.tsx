"use client";

import { useRef, useState } from "react";
import {
  AdminPage, Card, Button, Chip, Message, Stat, T, inputStyle,
} from "@/components/admin/ui";
import { adminFetch } from "@/lib/modules/admin-session";
import { SAMPLE_CSV } from "@/lib/server/import-students";

/**
 * นำเข้านักเรียนจากไฟล์ CSV
 *
 * บังคับให้ตรวจก่อนเขียนเสมอ — ปุ่ม "บันทึกจริง" จะโผล่ก็ต่อเมื่อตรวจแล้ว
 * และจะหายไปทันทีที่ข้อมูลถูกแก้ เพราะการนำเข้าเป็นการเขียนข้อมูลจริงหลายร้อย
 * แถวรวดเดียว พลาดแล้วย้อนยากกว่าการกรอกผิดทีละคนมาก
 *
 * ไม่รองรับ .xlsx โดยตั้งใจ — ให้ Save As เป็น CSV UTF-8 ซึ่งเป็นขั้นตอนเดียว
 * แลกกับการไม่ต้องแบก dependency อ่าน xlsx ทั้งก้อนไว้ใช้ฟีเจอร์เดียว
 */

type Outcome = {
  line: number;
  student_id: string;
  name: string;
  class_group: string | null;
  status: "new" | "duplicate" | "invalid";
  errors: string[];
};

type Summary = { total: number; new: number; duplicate: number; invalid: number; inserted?: number };

type Result = {
  status: string;
  message?: string;
  committed?: boolean;
  summary?: Summary;
  outcomes?: Outcome[];
  headers_found?: string[];
};

const STATUS_LABEL: Record<Outcome["status"], { text: string; tone: "ok" | "warn" | "danger" }> = {
  new: { text: "จะเพิ่มใหม่", tone: "ok" },
  duplicate: { text: "มีอยู่แล้ว ข้าม", tone: "warn" },
  invalid: { text: "ข้อมูลไม่ผ่าน", tone: "danger" },
};

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  /** แก้ข้อมูลเมื่อไหร่ ผลตรวจเดิมใช้ไม่ได้แล้ว ต้องตรวจใหม่ก่อนบันทึก */
  function changeCsv(next: string, name: string | null) {
    setCsv(next);
    setFileName(name);
    setResult(null);
    setShowAll(false);
  }

  async function readFile(file: File) {
    const text = await file.text();
    changeCsv(text, file.name);
  }

  async function run(commit: boolean) {
    setBusy(true);
    try {
      const res = await adminFetch("/api/admin/import/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, commit }),
      });
      setResult(await res.json());
    } catch {
      setResult({ status: "error", message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" });
    } finally {
      setBusy(false);
    }
  }

  function downloadSample() {
    // BOM นำหน้า ไม่งั้น Excel บน Windows เปิดไฟล์ไทยเป็นตัวต่างดาว
    const blob = new Blob(["﻿" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ตัวอย่าง-นำเข้านักเรียน.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = result?.summary;
  const outcomes = result?.outcomes ?? [];
  // แถวที่มีปัญหาขึ้นก่อนเสมอ เพราะเป็นสิ่งเดียวที่ผู้ใช้ต้องลงมือแก้
  const sorted = [...outcomes].sort((a, b) => {
    const rank = { invalid: 0, duplicate: 1, new: 2 };
    return rank[a.status] - rank[b.status] || a.line - b.line;
  });
  const shown = showAll ? sorted : sorted.slice(0, 50);
  const canCommit = !!s && !result?.committed && s.new > 0;

  return (
    <AdminPage
      title="นำเข้าข้อมูลนักเรียน"
      subtitle="อ่านไฟล์ CSV แล้วตรวจก่อน จากนั้นค่อยบันทึกลงระบบ"
      navId="import"
      width={1000}
      actions={<Button tone="neutral" onClick={downloadSample}>ดาวน์โหลดไฟล์ตัวอย่าง</Button>}
    >
      <Card>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.8, marginBottom: 14 }}>
          คอลัมน์ที่ต้องมี: <strong style={{ color: T.text }}>รหัสนักเรียน · ชื่อ · นามสกุล · ปีที่เข้า</strong>
          <br />
          ใส่เพิ่มได้: ชื่อเล่น · หลักสูตร · สาขา · เบอร์โทร · ห้อง · เพศ · วันเกิด
          <br />
          <span style={{ color: T.muted }}>
            ถ้าไฟล์เป็น .xlsx ให้เปิดใน Excel แล้ว Save As → <strong>CSV UTF-8</strong> ก่อน
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); }}
          />
          <Button tone="accent" onClick={() => fileRef.current?.click()}>เลือกไฟล์ CSV</Button>
          {fileName && <Chip tone="info">{fileName}</Chip>}
          {csv && <Chip tone="neutral">{csv.split("\n").filter(Boolean).length - 1} แถว</Chip>}
        </div>

        <textarea
          value={csv}
          onChange={(e) => changeCsv(e.target.value, null)}
          placeholder="หรือวางข้อมูลจาก Excel ลงตรงนี้ได้เลย"
          rows={8}
          style={{ ...inputStyle, width: "100%", fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <Button tone="info" onClick={() => void run(false)} disabled={!csv.trim() || busy}>
            {busy ? "กำลังตรวจ…" : "ตรวจข้อมูล"}
          </Button>
          {canCommit && (
            <Button tone="ok" onClick={() => void run(true)} disabled={busy}>
              บันทึกจริง {s.new} คน
            </Button>
          )}
        </div>
      </Card>

      {result?.status === "error" && (
        <Message tone="err">
          {result.message}
          {result.headers_found && (
            <div style={{ marginTop: 6, fontSize: 12 }}>
              หัวตารางที่เจอในไฟล์: {result.headers_found.join(" · ") || "(ไม่มี)"}
            </div>
          )}
        </Message>
      )}

      {s && (
        <>
          {result?.committed ? (
            <Message tone="ok">
              บันทึกแล้ว {s.inserted} คน · ข้ามเพราะมีอยู่แล้ว {s.duplicate} · ข้ามเพราะข้อมูลไม่ผ่าน {s.invalid}
            </Message>
          ) : (
            // Message มีแค่โทนเขียว/แดง ซึ่งสื่อว่า "สำเร็จ" หรือ "ผิดพลาด"
            // ทั้งที่ผลตรวจยังไม่ใช่ทั้งสองอย่าง จึงใช้กล่องกลางแทน
            <div style={{
              background: T.card2, border: `1px solid ${T.line}`, color: T.muted,
              borderRadius: 10, padding: "9px 12px", fontSize: 13, marginBottom: 12,
            }}>
              ยังไม่ได้บันทึกอะไรลงระบบ — ตรวจรายการด้านล่างแล้วกด &quot;บันทึกจริง&quot;
            </div>
          )}

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", margin: "14px 0" }}>
            <Stat label="ทั้งหมดในไฟล์" value={s.total} />
            <Stat label={result?.committed ? "เพิ่มแล้ว" : "จะเพิ่มใหม่"} value={result?.committed ? (s.inserted ?? 0) : s.new} />
            <Stat label="มีอยู่แล้ว" value={s.duplicate} />
            <Stat label="ข้อมูลไม่ผ่าน" value={s.invalid} />
          </div>

          <Card>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: T.muted, textAlign: "left" }}>
                    <th style={th}>บรรทัด</th>
                    <th style={th}>รหัส</th>
                    <th style={th}>ชื่อ</th>
                    <th style={th}>ห้อง</th>
                    <th style={th}>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o) => (
                    <tr key={o.line} style={{ borderTop: `1px solid ${T.card2}` }}>
                      <td style={td}>{o.line}</td>
                      <td style={td}>{o.student_id || "—"}</td>
                      <td style={td}>{o.name.trim() || "—"}</td>
                      <td style={td}>{o.class_group ?? "—"}</td>
                      <td style={td}>
                        <Chip tone={STATUS_LABEL[o.status].tone}>{STATUS_LABEL[o.status].text}</Chip>
                        {o.errors.length > 0 && (
                          <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                            {o.errors.join(" · ")}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > shown.length && (
              <div style={{ marginTop: 10 }}>
                <Button tone="neutral" onClick={() => setShowAll(true)}>
                  ดูอีก {sorted.length - shown.length} แถว
                </Button>
              </div>
            )}
          </Card>
        </>
      )}
    </AdminPage>
  );
}

const th: React.CSSProperties = { padding: "6px 10px", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
