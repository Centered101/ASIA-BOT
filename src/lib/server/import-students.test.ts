import { describe, expect, it } from "vitest";
import { parseStudentCsv, SAMPLE_CSV } from "./import-students";

const HEAD = "รหัสนักเรียน,ชื่อ,นามสกุล,ปีที่เข้า";

describe("parseStudentCsv — หัวตาราง", () => {
  it("รับหัวตารางภาษาไทย", () => {
    const r = parseStudentCsv(`${HEAD}\n30101,สมชาย,ใจดี,2567`);
    expect(r.missingRequired).toEqual([]);
    expect(r.rows[0].draft?.first_name).toBe("สมชาย");
  });

  it("รับหัวตารางภาษาอังกฤษด้วย", () => {
    const r = parseStudentCsv("student_id,first_name,last_name,entry_year\n30101,A,B,2567");
    expect(r.missingRequired).toEqual([]);
  });

  it("ไม่สนตัวพิมพ์และช่องว่างในหัวตาราง", () => {
    const r = parseStudentCsv("Student ID, First Name ,LAST-NAME,Entry Year\n30101,A,B,2567");
    expect(r.missingRequired).toEqual([]);
  });

  it("ขาดคอลัมน์บังคับ ต้องบอกว่าขาดอันไหน และไม่ประมวลผลแถวเลย", () => {
    const r = parseStudentCsv("รหัสนักเรียน,ชื่อ\n30101,สมชาย");
    expect(r.missingRequired).toEqual(["last_name", "entry_year"]);
    expect(r.rows).toEqual([]);
  });
});

describe("parseStudentCsv — ตรวจแถว", () => {
  it("แถวที่ขาดค่าบังคับถูกทำเครื่องหมายผิด ไม่ใช่เงียบ ๆ", () => {
    const r = parseStudentCsv(`${HEAD}\n,สมชาย,ใจดี,2567`);
    expect(r.rows[0].draft).toBeNull();
    expect(r.rows[0].errors).toContain("ไม่มีรหัสนักเรียน");
  });

  it("จับรหัสซ้ำภายในไฟล์เดียวกัน และชี้บรรทัดแรกที่เจอ", () => {
    const r = parseStudentCsv(`${HEAD}\n30101,ก,ข,2567\n30101,ค,ง,2567`);
    expect(r.rows[0].errors).toEqual([]);
    expect(r.rows[1].errors[0]).toContain("ซ้ำกับบรรทัด 2");
  });

  it("เลขบรรทัดตรงกับที่เห็นใน Excel (หัวตารางคือบรรทัด 1)", () => {
    const r = parseStudentCsv(`${HEAD}\n30101,ก,ข,2567\n30102,ค,ง,2567`);
    expect(r.rows.map((x) => x.line)).toEqual([2, 3]);
  });

  it("แถวที่ผิดไม่ทำให้แถวที่ถูกตกไปด้วย", () => {
    const r = parseStudentCsv(`${HEAD}\n,ก,ข,2567\n30102,ค,ง,2567`);
    expect(r.rows[0].draft).toBeNull();
    expect(r.rows[1].draft?.student_id).toBe("30102");
  });
});

describe("parseStudentCsv — แปลงค่า", () => {
  const withCols = (cols: string, vals: string) =>
    parseStudentCsv(`${HEAD},${cols}\n30101,ก,ข,2567,${vals}`).rows[0];

  it("เพศไทยและอังกฤษแปลงเป็นค่าใน DB", () => {
    expect(withCols("เพศ", "ชาย").draft?.gender).toBe("male");
    expect(withCols("เพศ", "หญิง").draft?.gender).toBe("female");
    expect(withCols("เพศ", "Female").draft?.gender).toBe("female");
  });

  it("เพศที่ไม่รู้จักเป็น error ไม่ใช่ null เงียบ ๆ", () => {
    expect(withCols("เพศ", "ไม่ระบุ").errors[0]).toContain("ไม่รู้จัก");
  });

  it("วันเกิดแบบไทย DD/MM/พ.ศ. แปลงเป็น ค.ศ.", () => {
    expect(withCols("วันเกิด", "15/03/2551").draft?.birth_date).toBe("2008-03-15");
  });

  it("วันเกิดแบบ ISO ปล่อยผ่าน", () => {
    expect(withCols("วันเกิด", "2008-07-22").draft?.birth_date).toBe("2008-07-22");
  });

  it("วันเกิดเดือน 13 ถูกปฏิเสธ", () => {
    expect(withCols("วันเกิด", "01/13/2551").errors[0]).toContain("ไม่ใช่วันที่ที่มีจริง");
  });

  it("วันเกิดว่างไม่ใช่ error", () => {
    const row = withCols("วันเกิด", "");
    expect(row.errors).toEqual([]);
    expect(row.draft?.birth_date).toBeNull();
  });

  it("เบอร์โทรที่ไม่กรอกได้ค่าว่าง เพราะคอลัมน์ใน DB เป็น NOT NULL", () => {
    expect(withCols("เบอร์โทร", "").draft?.student_phone).toBe("");
  });

  it("ชื่อห้องถูกส่งต่อเป็นข้อความ ให้ชั้น route ไปหา id เอง", () => {
    expect(withCols("ห้อง", "ปวช.1/5").draft?.class_group_name).toBe("ปวช.1/5");
  });
});

describe("SAMPLE_CSV", () => {
  it("ไฟล์ตัวอย่างต้องนำเข้าได้จริงทุกแถว ไม่งั้นคนโหลดไปกรอกจะเจอ error ทันที", () => {
    const r = parseStudentCsv(SAMPLE_CSV);
    expect(r.missingRequired).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows.every((x) => x.errors.length === 0)).toBe(true);
  });
});

describe("raw — แถวที่ไม่ผ่านยังต้องบอกได้ว่าเป็นของใคร", () => {
  it("แถวที่ผิดยังมีรหัสและชื่อไว้แสดงในตารางผลตรวจ", () => {
    // ก่อนหน้านี้ตารางขึ้น "—" ให้ทุกแถวที่ผิด ทั้งที่อ่านค่าจากไฟล์มาแล้ว
    const r = parseStudentCsv(`${HEAD},เพศ\n30101,สมชาย,ใจดี,2567,ไม่ระบุ`);
    expect(r.rows[0].draft).toBeNull();
    expect(r.rows[0].raw).toEqual({ student_id: "30101", name: "สมชาย ใจดี" });
  });

  it("แถวที่ขาดรหัสได้ค่าว่าง ไม่ใช่ undefined", () => {
    const r = parseStudentCsv(`${HEAD}\n,สมชาย,ใจดี,2567`);
    expect(r.rows[0].raw.student_id).toBe("");
    expect(r.rows[0].raw.name).toBe("สมชาย ใจดี");
  });
});
