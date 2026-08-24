# Migrations

ตั้งแต่ Phase 1 เป็นต้นไป **ไฟล์ในโฟลเดอร์นี้คือแหล่งความจริงของ schema**
`supabase/schema.sql` เป็นแค่ snapshot ของสถานะปัจจุบัน — regenerate จากฐานข้อมูลจริง ห้ามแก้มือเพื่อเพิ่มของใหม่

## กฎ (เพราะมีแต่ production ไม่มี staging)

1. **เพิ่มอย่างเดียว** — `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`
   ห้าม `DROP`, ห้าม `RENAME`, ห้ามเปลี่ยน type ของคอลัมน์เดิม
2. **คอลัมน์ใหม่ต้อง nullable หรือมี DEFAULT** — ห้าม `NOT NULL` บนตารางที่มีข้อมูลแล้วโดยไม่มี default
3. **รันซ้ำได้** — ทุกไฟล์ต้องรันสองครั้งแล้วผลเหมือนเดิม นี่คือสิ่งที่ใช้แทนการซ้อมบน staging
4. **ทุกไฟล์ต้องมี `-- ROLLBACK:`** ระบุคำสั่งย้อนกลับที่ถูกต้อง
5. **Backup ก่อนทุกครั้ง** — สั่ง `workflow_dispatch` ที่ `.github/workflows/backup-db.yml`
   รอจน artifact ขึ้นจริงก่อนค่อยรัน
6. **รันทีละไฟล์** แล้ว smoke query ก่อนไปไฟล์ถัดไป
7. **Backfill แยกจาก DDL** — ใช้ `INSERT ... ON CONFLICT DO NOTHING` เสมอ

## วิธีรัน

Supabase Dashboard → SQL Editor → วางเนื้อไฟล์ทีละไฟล์ → Run
ตรวจ smoke query ที่อยู่ท้ายไฟล์แต่ละไฟล์ก่อนไปต่อ

## ลำดับของ Phase 1

| ไฟล์ | ทำอะไร |
|---|---|
| `0001_user_accounts.sql` | ตาราง identity กลาง + `account_id` (nullable) บน admins / teachers / students |
| `0002_backfill_accounts.sql` | Data-only — สร้าง account ให้แถวที่มีอยู่แล้วและผูก `account_id` |
| `0003_rbac.sql` | roles / permissions / role_permissions / user_roles + seed |
| `0004_sessions.sql` | `auth_sessions` สำหรับ signed cookie |
| `0005_audit_log.sql` | `audit_logs` |
| `0006_student_core.sql` | คอลัมน์ Student 360 บน `students` |
| `0007_deprecate_dead_tables.sql` | COMMENT ตารางที่ไม่มีโค้ดใช้แล้ว (ไม่ DROP) |
| `0008_realtime_trim.sql` | เอา `admins` ออกจาก realtime publication (มันกระจาย password_hash) |
| `0009_backfill_user_roles.sql` | Data-only — ให้ role กับ account ที่มีอยู่แล้ว |
| `0010_link_dual_profile.sql` | Data-only — ผูก profile นักเรียนของคนที่มีสองบทบาทเข้ากับ account เดียว |

## Phase 2 — Student 360

| ไฟล์ | ทำอะไร |
|---|---|
| `0011_guardians.sql` | ผู้ปกครองและผู้ติดต่อฉุกเฉิน |
| `0012_student_history.sql` | ประวัติการศึกษาเดิม และประวัติการเปลี่ยนสถานะ |
| `0013_student_achievements.sql` | ผลงาน รางวัล การแข่งขัน และตำแหน่งในโรงเรียน |

## Phase 3 — ครุภัณฑ์และงานซ่อม

| ไฟล์ | ทำอะไร |
|---|---|
| `0014_assets.sql` | ทะเบียนครุภัณฑ์รายชิ้น และประวัติการย้าย |
| `0015_maintenance.sql` | ระบบแจ้งซ่อมอาคารสถานที่ เครื่องมือ อุปกรณ์ |
| `0016_maintenance_permissions.sql` | สิทธิ์ของโมดูลแจ้งซ่อมและครุภัณฑ์ |
| `0017_maintenance_affected_quantity.sql` | เพิ่ม `affected_quantity` ให้ `maintenance_requests` |

## Phase 4 — เช็กชื่อรายคาบ

| ไฟล์ | ทำอะไร |
|---|---|
| `0018_class_attendance.sql` | เช็กชื่อรายวิชา และงานที่สั่งในคาบ |
| `0019_admin_division.sql` | เพิ่ม `division` (ฝ่าย) ให้ `admins` |
| `0020_student_self_service.sql` | ให้นักเรียนกรอกข้อมูลของตัวเองได้ |
| `0021_deprecate_student_positions.sql` | COMMENT ตารางที่เลิกใช้เพิ่ม (ไม่ลบอะไร) |

## Phase 6 — ศูนย์แจ้งเตือนและศูนย์เอกสาร

| ไฟล์ | ทำอะไร |
|---|---|
| `0022_notifications.sql` | `notifications`, `notification_preferences` |
| `0023_documents.sql` | `document_types`, `student_documents`, `document_requests`, `document_request_history` |
| `0024_agent_log_permissions.sql` | สิทธิ์ดูประวัติการคุยกับผู้ช่วย AI |
