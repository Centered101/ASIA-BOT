import { describe, it, expect } from "vitest";
import type { MaintenanceStatus } from "@/types/database";
import {
  MAINTENANCE_FLOW,
  MAINTENANCE_STATUS_TH,
  MAINTENANCE_TRANSITIONS,
  OPEN_STATUSES,
  canTransition,
  targetError,
  transitionError,
} from "./maintenance";

const ALL: MaintenanceStatus[] = [
  "reported", "received", "inspecting", "assigned",
  "repairing", "waiting_inspection", "completed", "cancelled",
];

describe("ตาราง transition", () => {
  it("มีทุกสถานะครบและมีคำแปลไทยครบ", () => {
    for (const s of ALL) {
      expect(MAINTENANCE_TRANSITIONS[s], `${s} ไม่มีใน transitions`).toBeDefined();
      expect(MAINTENANCE_STATUS_TH[s], `${s} ไม่มีคำแปลไทย`).toBeTruthy();
    }
  });

  it("ชี้ไปหาสถานะที่มีอยู่จริงเท่านั้น", () => {
    for (const [from, targets] of Object.entries(MAINTENANCE_TRANSITIONS)) {
      for (const to of targets) {
        expect(ALL, `${from} -> ${to} ชี้ไปสถานะที่ไม่มีอยู่`).toContain(to);
      }
    }
  });

  it("เดินหน้าตามลำดับปกติได้ทุกขั้น", () => {
    for (let i = 0; i < MAINTENANCE_FLOW.length - 1; i++) {
      const from = MAINTENANCE_FLOW[i];
      const to = MAINTENANCE_FLOW[i + 1];
      expect(canTransition(from, to), `${from} -> ${to} ควรผ่าน`).toBe(true);
    }
  });

  // นี่คือบั๊กที่ test ชุดนี้มีไว้จับ: ถ้าใครแก้ตารางแล้วเผลอเปิดทางลัด
  // งานจะถูกปิดโดยไม่มีใครตรวจสอบหรือซ่อมจริง
  it("ข้ามขั้นไม่ได้", () => {
    expect(canTransition("reported", "completed")).toBe(false);
    expect(canTransition("reported", "repairing")).toBe(false);
    expect(canTransition("received", "waiting_inspection")).toBe(false);
    expect(canTransition("inspecting", "completed")).toBe(false);
    expect(canTransition("assigned", "completed")).toBe(false);
  });

  it("ยกเลิกได้จากทุกขั้นที่ยังไม่ปิดงาน", () => {
    for (const s of OPEN_STATUSES) {
      expect(canTransition(s, "cancelled"), `${s} ควรยกเลิกได้`).toBe(true);
    }
  });

  it("สถานะปลายทางไปต่อไม่ได้", () => {
    for (const to of ALL) {
      expect(canTransition("completed", to), `completed -> ${to}`).toBe(false);
      expect(canTransition("cancelled", to), `cancelled -> ${to}`).toBe(false);
    }
  });

  it("ถอยกลับได้เฉพาะกรณีที่เกิดจริง", () => {
    // ตรวจรับไม่ผ่าน ต้องกลับไปซ่อมใหม่
    expect(canTransition("waiting_inspection", "repairing")).toBe(true);
    // มอบหมายผิดคน กลับไปตรวจสอบใหม่
    expect(canTransition("assigned", "inspecting")).toBe(true);
    // แต่ถอยข้ามหลายขั้นไม่ได้
    expect(canTransition("repairing", "received")).toBe(false);
    expect(canTransition("waiting_inspection", "reported")).toBe(false);
  });

  it("ไม่นับ completed เป็นงานค้าง", () => {
    expect(OPEN_STATUSES).not.toContain("completed");
    expect(OPEN_STATUSES).not.toContain("cancelled");
    expect(OPEN_STATUSES).toContain("reported");
  });
});

describe("ข้อความ error ของ transition", () => {
  it("ไม่มี error เมื่อเปลี่ยนได้", () => {
    expect(transitionError("reported", "received")).toBeNull();
  });

  it("บอกว่าขั้นถัดไปทำอะไรได้บ้าง", () => {
    const msg = transitionError("reported", "completed");
    expect(msg).toContain("รับเรื่องแล้ว");
  });

  it("บอกให้เปิดคำขอใหม่เมื่องานปิดไปแล้ว", () => {
    expect(transitionError("completed", "repairing")).toContain("เปิดคำขอใหม่");
  });

  it("จับกรณีสถานะเดิมซ้ำ", () => {
    expect(transitionError("repairing", "repairing")).toContain("เหมือนกัน");
  });
});

describe("การระบุสิ่งที่จะซ่อม", () => {
  it("ต้องมี target_label เมื่อไม่มีเลขครุภัณฑ์", () => {
    expect(targetError({ target_kind: "other" })).toBeTruthy();
    expect(targetError({ target_kind: "other", target_label: "   " })).toBeTruthy();
    expect(
      targetError({ target_kind: "other", target_label: "โต๊ะตัวที่สาม ห้อง 302" })
    ).toBeNull();
  });

  it("ต้องมี id ตรงกับ kind ที่เลือก", () => {
    expect(targetError({ target_kind: "asset" })).toBeTruthy();
    expect(targetError({ target_kind: "asset", asset_id: "a" })).toBeNull();

    expect(targetError({ target_kind: "room" })).toBeTruthy();
    expect(targetError({ target_kind: "room", room_id: "r" })).toBeNull();

    expect(targetError({ target_kind: "equipment_item" })).toBeTruthy();
    expect(targetError({ target_kind: "equipment_item", equipment_item_id: "e" })).toBeNull();
  });

  // ใส่ id ผิดช่องต้องไม่ผ่าน ไม่งั้นช่างจะได้ใบงานที่ชี้ไปผิดของ
  it("ไม่ยอมรับ id ที่ใส่ผิดช่อง", () => {
    expect(targetError({ target_kind: "asset", room_id: "r" })).toBeTruthy();
    expect(targetError({ target_kind: "room", asset_id: "a" })).toBeTruthy();
  });
});
