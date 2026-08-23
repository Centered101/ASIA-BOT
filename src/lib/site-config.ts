/**
 * ชื่อและที่อยู่ของ Mycer — แหล่งความจริงเดียวของทั้งซับโดเมน
 *
 * ทุกที่ที่ชื่อ Mycer โผล่ให้ผู้ใช้เห็น (โลโก้ หัวเรื่องแท็บ หน้าล็อกอิน ฮีโร่
 * ท้ายหน้า และลิงก์ในเมนูของเว็บหลัก) อ่านจากไฟล์นี้ที่เดียว เปลี่ยนชื่อจึงแก้
 * ที่ env ตัวเดียวจบ ไม่ต้องไล่แก้ในโค้ด
 *
 * ทำไมไม่ใช้ NEXT_PUBLIC_APP_NAME เหมือนเดิม: มันไม่ได้บอกว่าเป็นชื่อของฝั่งไหน
 * ในโปรเจกต์ที่มีสองแบรนด์อยู่ด้วยกัน (asia-bot ใช้ NEXT_PUBLIC_SITE_NAME ใน
 * lib/config.ts) แถมไม่เคยถูกเขียนไว้ใน .env.example เลย คนตั้งค่าจึงไม่มีทาง
 * รู้ว่ามีตัวนี้อยู่ ตอนนี้ตั้งชื่อให้อยู่ในตระกูล NEXT_PUBLIC_MYCER_* เดียวกับ
 * ตัวอื่นแล้ว
 *
 * ข้อควรรู้: NEXT_PUBLIC_* ถูกฝังตอน build เปลี่ยนบน Vercel แล้วต้อง deploy ใหม่
 * ถึงมีผล (บนเครื่องตัวเองแค่รีสตาร์ท dev server)
 */
export const SITE_NAME = process.env.NEXT_PUBLIC_MYCER_NAME ?? "Mycer"

/**
 * โดเมนของ Mycer ใช้ทำ canonical / sitemap / og
 *
 * คนละเรื่องกับ NEXT_PUBLIC_MYCER_SUBDOMAIN ที่ middleware ใช้ตัดสินว่าคำขอนี้
 * เป็นของ Mycer — ตัวนั้นต้องตรงกับ DNS จริง จึงตั้งใจไม่ให้ผูกกับชื่อแบรนด์
 * ข้างบน เปลี่ยนชื่อที่แสดงผลแล้วเส้นทางต้องไม่ขยับตาม
 */
export const SITE_URL = process.env.NEXT_PUBLIC_MYCER_URL ?? "http://localhost:3000"

export const SITE_DESCRIPTION =
  process.env.NEXT_PUBLIC_MYCER_DESCRIPTION ??
  "ระบบเว็บแฟ้มสะสมผลงานดิจิทัลสำหรับนักเรียน นักศึกษา และอาจารย์ เก็บผลงาน เกียรติบัตร กิจกรรม และสร้าง Portfolio ออนไลน์"

export const THEME_COLOR = process.env.NEXT_PUBLIC_MYCER_THEME_COLOR ?? "#4170e9"
