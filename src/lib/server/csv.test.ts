import { describe, expect, it } from "vitest";
import { normalizeHeader, parseCsv, readCsv } from "./csv";

describe("parseCsv", () => {
  it("อ่านตารางธรรมดา", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("จบบรรทัดแบบ CRLF ของ Windows", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("ตัด BOM ที่ Excel ใส่มาให้ตอนเซฟ UTF-8", () => {
    // ถ้าไม่ตัด หัวคอลัมน์แรกจะไม่มีวันตรงกับที่โค้ดมองหา
    expect(parseCsv("﻿student_id,name\n1,ก")[0][0]).toBe("student_id");
  });

  it("ฟิลด์ในคำพูดที่มีคอมมาอยู่ข้างใน", () => {
    expect(parseCsv('a,b\n"1,5",2')).toEqual([["a", "b"], ["1,5", "2"]]);
  });

  it("ฟิลด์ในคำพูดที่ขึ้นบรรทัดใหม่ข้างใน", () => {
    expect(parseCsv('a,b\n"บรรทัด1\nบรรทัด2",2')).toEqual([
      ["a", "b"], ["บรรทัด1\nบรรทัด2", "2"],
    ]);
  });

  it('คำพูดซ้อน "" คืออักขระคำพูดหนึ่งตัว', () => {
    expect(parseCsv('a\n"เขาบอกว่า ""สวัสดี"""')).toEqual([
      ["a"], ['เขาบอกว่า "สวัสดี"'],
    ]);
  });

  it("ไฟล์ที่ไม่ลงท้ายด้วยบรรทัดใหม่ ยังได้แถวสุดท้าย", () => {
    expect(parseCsv("a,b\n1,2")).toHaveLength(2);
  });

  it("ข้ามบรรทัดว่างระหว่างข้อมูล", () => {
    expect(parseCsv("a\n1\n\n2\n")).toEqual([["a"], ["1"], ["2"]]);
  });

  it("ช่องว่างล้วนยังนับเป็นข้อมูล ไม่ใช่บรรทัดว่าง", () => {
    expect(parseCsv("a,b\n,\n")).toEqual([["a", "b"], ["", ""]]);
  });
});

describe("normalizeHeader", () => {
  it("ตัดช่องว่าง แปลงพิมพ์เล็ก และรวมตัวคั่นเป็นขีดล่าง", () => {
    expect(normalizeHeader("  Student ID ")).toBe("student_id");
    expect(normalizeHeader("first-name")).toBe("first_name");
  });
});

describe("readCsv", () => {
  it("จับคู่หัวตารางกับค่าในแถว", () => {
    const t = readCsv("Student ID,First Name\n3001,สมชาย");
    expect(t.headers).toEqual(["student_id", "first_name"]);
    expect(t.rows).toEqual([{ student_id: "3001", first_name: "สมชาย" }]);
  });

  it("แถวที่สั้นกว่าหัวตารางได้ค่าว่าง ไม่ใช่ undefined", () => {
    // ไฟล์จริงมีแถวที่คนลบค่าท้าย ๆ ออกจนคอลัมน์ขาด ถ้าเป็น undefined
    // การ trim() ในขั้นตรวจจะพังทั้งการนำเข้า
    expect(readCsv("a,b,c\n1,2").rows[0]).toEqual({ a: "1", b: "2", c: "" });
  });

  it("ทิ้งแถวว่างท้ายไฟล์", () => {
    expect(readCsv("a,b\n1,2\n,\n").rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("ไฟล์เปล่าไม่ทำให้พัง", () => {
    expect(readCsv("")).toEqual({ headers: [], rows: [] });
  });
});
