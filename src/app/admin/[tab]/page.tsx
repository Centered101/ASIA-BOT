/**
 * ทุกแท็บของหลังบ้านมี path ของตัวเอง — /admin/<tab>
 *
 * เดิมทุกหน้าอยู่ใต้ /admin?tab=<id> ซึ่งอ่านไม่รู้เรื่องเวลาแชร์ลิงก์ และ
 * Next มองว่าเป็นหน้าเดียวกันหมด ไฟล์นี้จึงรับ path ทุกแบบแล้วส่งต่อให้ shell
 * ตัวเดิม ซึ่งอ่านชื่อแท็บจาก pathname เอง
 *
 * ไม่ได้ก๊อป component มาใหม่ — เป็นตัวเดียวกับ /admin เป๊ะ ดังนั้น sidebar,
 * การเช็กสิทธิ์ และ realtime ทำงานเหมือนเดิมทุกอย่าง
 *
 * หน้าที่มีไฟล์ของตัวเองแล้ว (students, maintenance, assets, import,
 * class-attendance) ไม่ถูกจับโดย [tab] เพราะ Next ให้ segment แบบตายตัว
 * มาก่อน dynamic segment เสมอ
 */
export { default } from "../page";
