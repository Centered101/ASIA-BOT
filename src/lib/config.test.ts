import { describe, expect, it } from "vitest";
import { parseTeam } from "./config";

describe("parseTeam", () => {
  it("อ่านชื่อผู้ใช้คั่นคอมมา", () => {
    expect(parseTeam("a,b,c")).toEqual([
      { login: "a", role: undefined },
      { login: "b", role: undefined },
      { login: "c", role: undefined },
    ]);
  });

  it("ตัดช่องว่างรอบชื่อ เพราะคนตั้ง env มักเว้นวรรคหลังคอมมา", () => {
    expect(parseTeam("Centered101, Centered101-dev").map((m) => m.login))
      .toEqual(["Centered101", "Centered101-dev"]);
  });

  it("อ่านบทบาทหลังเครื่องหมาย |", () => {
    expect(parseTeam("Centered101|หัวหน้าทีม")).toEqual([
      { login: "Centered101", role: "หัวหน้าทีม" },
    ]);
  });

  it("ผสมกันได้ ใส่บทบาทเฉพาะบางคน", () => {
    expect(parseTeam("a|ผู้ดูแล, b")).toEqual([
      { login: "a", role: "ผู้ดูแล" },
      { login: "b", role: undefined },
    ]);
  });

  it("บทบาทที่เป็นช่องว่างล้วนถือว่าไม่ได้ใส่ ไม่ใช่ข้อความว่าง", () => {
    // ไม่งั้น bio จะถูกทับด้วยค่าว่าง แล้วการ์ดจะดูเหมือนโหลดไม่ขึ้น
    expect(parseTeam("a|   ")[0].role).toBeUndefined();
  });

  it("ข้ามช่องว่างเปล่าจากคอมมาเกิน", () => {
    expect(parseTeam("a,,b, ,c").map((m) => m.login)).toEqual(["a", "b", "c"]);
  });

  it("ค่าว่างหรือไม่ได้ตั้ง ได้ลิสต์เปล่า ให้ตัวเรียกไปใช้ค่าตั้งต้นต่อ", () => {
    expect(parseTeam("")).toEqual([]);
    expect(parseTeam(undefined)).toEqual([]);
    expect(parseTeam("   ")).toEqual([]);
  });
});
