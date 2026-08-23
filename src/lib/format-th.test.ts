import { describe, expect, it } from "vitest";
import { ageFrom, thaiDate, thaiDateLong, thaiDateTime } from "./format-th";

describe("thaiDate", () => {
  it("แปลงเป็น พ.ศ. ให้เอง ไม่ต้องบวก 543", () => {
    // ค.ศ. 2008 → พ.ศ. 2551
    expect(thaiDate("2008-11-28")).toContain("2551");
  });

  it("ขึ้นวันกับเดือนแบบย่อภาษาไทย", () => {
    const out = thaiDate("2008-11-28");
    expect(out).toContain("28");
    expect(out).toContain("พ.ย.");
  });

  it("ไม่เลื่อนวันตามเขตเวลาของเครื่อง", () => {
    // "2008-11-28" ถ้าอ่านเป็นเที่ยงคืน UTC แล้วแปลงเป็นโซนลบ จะกลายเป็นวันที่ 27
    expect(thaiDate("2008-11-28")).toContain("28");
    expect(thaiDate("2008-01-01")).toContain("1");
    expect(thaiDate("2008-01-01")).toContain("2551");
  });

  it("ค่าว่างได้ขีด ไม่ใช่ Invalid Date", () => {
    expect(thaiDate(null)).toBe("—");
    expect(thaiDate(undefined)).toBe("—");
    expect(thaiDate("")).toBe("—");
  });

  it("ค่าที่อ่านไม่ออกคืนของเดิม ดีกว่าโชว์ Invalid Date", () => {
    expect(thaiDate("ไม่ใช่วันที่")).toBe("ไม่ใช่วันที่");
  });
});

describe("thaiDateLong", () => {
  it("ใช้ชื่อเดือนเต็ม", () => {
    expect(thaiDateLong("2008-11-28")).toContain("พฤศจิกายน");
  });
});

describe("thaiDateTime", () => {
  it("มีทั้งวันที่และเวลา", () => {
    const out = thaiDateTime("2008-11-28T14:30:00+07:00");
    expect(out).toContain("2551");
    expect(out).toContain("14");
    expect(out).toContain("30");
  });
});

describe("ageFrom", () => {
  const now = new Date("2026-08-19T12:00:00+07:00");

  it("คิดอายุจากวันเกิด", () => {
    expect(ageFrom("2008-01-01", now)).toBe(18);
  });

  it("ยังไม่ถึงวันเกิดปีนี้ ต้องได้อายุน้อยกว่าหนึ่งปี", () => {
    expect(ageFrom("2008-11-28", now)).toBe(17);
  });

  it("วันเกิดวันนี้พอดี นับเป็นครบรอบแล้ว", () => {
    expect(ageFrom("2008-08-19", now)).toBe(18);
  });

  it("ค่าที่ใช้ไม่ได้คืน null ให้ผู้เรียกตัดสินใจเอง", () => {
    expect(ageFrom(null, now)).toBeNull();
    expect(ageFrom("ไม่ใช่วันที่", now)).toBeNull();
  });

  it("วันเกิดในอนาคตคืน null ไม่ใช่อายุติดลบ", () => {
    expect(ageFrom("2030-01-01", now)).toBeNull();
  });
});
