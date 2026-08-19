import { redirect } from "next/navigation";

/**
 * กลุ่มเรียนถูกยุบไปเป็นแท็บในหน้านักเรียนแล้ว
 *
 * ไฟล์นี้มีไว้ให้ลิงก์เดิม /admin/class_groups (ที่คนบุ๊กมาร์กไว้ หรือที่ยัง
 * ฝังอยู่ในลิงก์เก่า) ไม่ตายเงียบ ๆ แต่พาไปยังที่ใหม่แทน
 *
 * ต้องเป็นโฟลเดอร์จริง เพราะ Next ให้ segment แบบตายตัวมาก่อน [tab]
 */
export default function ClassGroupsRedirectPage() {
  redirect("/admin/students?tab=groups");
}
