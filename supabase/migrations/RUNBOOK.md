# Phase 1 — Migration runbook (production)

ไม่มี staging — ทุกอย่างรันกับฐานข้อมูลจริง ทำตามลำดับนี้เท่านั้น

## ลำดับการ deploy

**Deploy โค้ดก่อน แล้วค่อยรัน migration ได้** — โค้ด Phase 1 ทนกับ schema เก่า:
`attachSessionCookie()` จะ no-op เงียบ ๆ ถ้ายังไม่มีตาราง `user_accounts`
และ `resolvePrincipal()` จะตกกลับไปใช้ `admins.role` ถ้า `account_id` ยัง NULL
ผู้ใช้ยังล็อกอินได้ตามปกติผ่าน `x-admin-id` เดิม

## 0. เตรียม

```
ตั้ง env ใหม่บน Vercel ก่อน deploy:
  SESSION_SIGNING_SECRET   ← บังคับ สร้างด้วย:
      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  AUTH_LEGACY_HEADER=1     ← ต้องเป็น 1 ใน Phase 1
```

## 1. Backup (ห้ามข้าม)

1. GitHub → Actions → **Supabase DB Backup** → Run workflow
2. รอจนขึ้นสีเขียว แล้ว **ดาวน์โหลด artifact จริง**
3. ทดสอบ restore ลงเครื่อง local ก่อน — backup ที่ restore ไม่ได้ไม่ใช่ backup

```bash
gunzip -c backup_*.sql.gz | psql "postgresql://localhost/asia_bot_restore_test"
```

## 2. Pre-flight

รันใน SQL Editor แล้ว**อ่านผลก่อน**:

```sql
-- students มีคอลัมน์อะไรอยู่แล้วบ้าง (0006 สนใจ student_status เป็นพิเศษ)
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='students'
 ORDER BY ordinal_position;

-- ถ้ามี student_status อยู่แล้ว ให้ดูค่าที่ใช้จริง
SELECT student_status, count(*) FROM public.students GROUP BY 1;

-- จำนวนแถวที่ 0002 จะ backfill
SELECT 'admins' t, count(*) FROM public.admins
UNION ALL SELECT 'students', count(*) FROM public.students
UNION ALL SELECT 'teachers(approved/active)', count(*) FROM public.teachers
   WHERE status IN ('approved','active') AND desired_username IS NOT NULL;

-- login ที่จะชนกันระหว่าง admins.username กับ students.student_id
SELECT a.username FROM public.admins a
  JOIN public.students s ON lower(s.student_id) = lower(a.username);
```

ถ้า query สุดท้ายคืนแถวใด ๆ → แก้ชื่อ username นั้นก่อน ไม่งั้น 0002 จะ backfill ไม่ครบ

## 3. รัน migration ทีละไฟล์

รันตามลำดับ `0001` → `0008` **ทีละไฟล์** และหลังแต่ละไฟล์ให้รัน SMOKE ที่อยู่ท้ายไฟล์นั้น
ห้ามรันไฟล์ถัดไปถ้า SMOKE ไม่ผ่าน

| ไฟล์ | จุดที่ต้องระวัง |
|---|---|
| `0001_user_accounts.sql` | สร้างตาราง + คอลัมน์ nullable ปลอดภัย |
| `0002_backfill_accounts.sql` | รัน `../diagnostics/collision-check.sql` ก่อนเสมอ **SMOKE ต้องได้ 0 ทั้งสามข้อ** ถ้าไม่ 0 = มี login ชนกัน — ดูหัวข้อ "ถ้า 0002 error 23505" ด้านล่าง |
| `0003_rbac.sql` | roles 20, permissions 47 |
| `0004_sessions.sql` | ตารางว่าง |
| `0005_audit_log.sql` | ตารางว่าง + index 5 ตัว |
| `0006_student_core.sql` | ถ้าขึ้น WARNING เรื่อง student_status → หยุด map ค่าเก่าก่อน แล้วรันซ้ำ |
| `0007_deprecate_dead_tables.sql` | COMMENT อย่างเดียว ไม่มี DROP |
| `0008_realtime_trim.sql` | ต้องเห็น `admins` ยังอยู่ใน publication แต่ **ไม่มี** `password_hash` |
| `0009_backfill_user_roles.sql` | **ห้ามข้าม** — 0003 seed แค่ตาราง role ไม่ได้ให้ role กับใคร ถ้าไม่รันไฟล์นี้ `user_roles` จะว่างและทุก admin ตกไปเป็น ACADEMIC (ดูหัวข้อ 4.2) |
| `0010_fix_login_collision.sql` | **ต้องแก้ไฟล์ก่อนรัน** — เปลี่ยน `CHANGE_ME` เป็น username ใหม่ทั้ง 2 จุด มี guard กันรันทั้งที่ยังไม่แก้ แล้วรัน `0002` และ `0009` ซ้ำ (ดูหัวข้อ 4.3) |

หลัง `0008` ให้เปิดหน้า `/admin` แล้วยืนยันว่าแท็บ **ผู้ดูแลระบบ** ยังอัปเดตสดข้ามแท็บได้อยู่

## 4. ทดสอบหลังรันครบ

| ทดสอบ | คาดหวัง |
|---|---|
| ล็อกอิน admin | สำเร็จ + ได้ cookie `asia_session` (httpOnly) |
| ล็อกอินนักเรียน | สำเร็จ + ได้ cookie |
| ทุกแท็บใน `/admin` | โหลดได้เหมือนเดิม |
| จองห้อง / สั่งซื้อ / เบิกคุรุภัณฑ์ | ทำงานเหมือนเดิม |
| RFID scan | `POST /api/rfid/scan` พร้อม `device_key` ที่ถูกต้อง |
| LINE webhook + AI chat | ตอบกลับเหมือนเดิม |
| `POST /api/admin/products` โดยไม่ล็อกอิน | **401** (เดิมเป็น 200 — นี่คือช่องโหว่ที่ปิด) |
| `staff` แก้ไขสินค้า | **403** (ตรงกับ convention เดิมที่ staff เขียนไม่ได้) |
| `staff` ดูสินค้า/ออเดอร์ | **200** — ต้องยังดูได้เหมือนเดิม |
| แก้ไขสินค้าโดย admin | สำเร็จ + มีแถวใน `audit_logs` พร้อม before/after |

```sql
SELECT action, actor_label, entity_id, created_at
  FROM public.audit_logs ORDER BY created_at DESC LIMIT 10;
```

## 4.1 ถ้า 0002 error `23505 ... user_accounts_google_id_key`

เจอจริงตอนรันครั้งแรก **เป็นบั๊กของ migration เอง ไม่ใช่ข้อมูลเสีย**

เวอร์ชันแรกใส่ `google_id` / `google_email` ลงไปใน `INSERT` ตรง ๆ โดยกันไว้แค่
`ON CONFLICT (lower(login))` — แต่ 0001 สร้าง unique index ไว้ **3 ตัว**
(`login`, `google_id`, `google_email`) และ `ON CONFLICT` รับได้ทีละตัวเท่านั้น

สาเหตุที่ชนคือเรื่องปกติของข้อมูลชุดนี้: `google_id` เก็บ Supabase Auth user id (UUID)
คนที่เป็นทั้ง admin และนักเรียนจึงมีค่าเดียวกันในสองตาราง — ซึ่งเป็นสิ่งที่
`admins.linked_student_id` มีไว้รองรับอยู่แล้ว

**แก้แล้วในไฟล์ 0002 ปัจจุบัน** — insert account โดยไม่แตะคอลัมน์ Google
แล้วค่อยเติมทีหลังเฉพาะค่าที่ไม่กำกวม profile ที่ "แพ้" ยังเก็บ `google_id` ของตัวเองไว้ครบ
และ Google login ปัจจุบัน resolve จากตาราง profile ไม่ใช่ `user_accounts` จึงไม่มีอะไรพัง

ขั้นตอน:

1. รัน `../diagnostics/collision-check.sql` — ข้อ 1 ควรได้ 0 ทั้งสามค่า (Supabase SQL Editor
   ครอบ transaction เดียว จึง rollback ให้แล้ว) ถ้าไม่ใช่ 0 ให้รัน ROLLBACK ของ 0002 ก่อน
2. รัน `0002_backfill_accounts.sql` เวอร์ชันใหม่
3. เช็ก SMOKE ต้องได้ 0 ทั้งสามข้อ
4. รัน query ท้ายไฟล์ (EXPECTED) เพื่อดูว่าใครที่ Google identity ไปอยู่กับอีก account
   — เป็นเรื่องปกติ ไม่ใช่ error

## 4.2 `user_roles` ว่าง → admin ทุกคนกลายเป็น ACADEMIC

เจอจริงตอนทดสอบ local กับข้อมูล production **บั๊กของ Phase 1 เอง แก้แล้วทั้งสองชั้น**

0003 seed `roles` / `permissions` / `role_permissions` แต่ **ไม่ได้สร้างแถว `user_roles`**
ส่วน 0002 ผูก `admins.account_id` ให้ทุกคนแล้ว ช่วงคาบเกี่ยวนี้
`loadRolesForAccount()` หา grant ไม่เจอ เลยตกไปใช้ default ตาม subject_type = `ACADEMIC`
→ **superadmin เสียสิทธิ์เขียนทั้งหมด** (ยืนยันแล้ว: POST `/api/admin/products` ได้ 403)

แก้ 2 ชั้น:
1. `src/lib/server/session.ts` ส่ง `LEGACY_ADMIN_ROLE_MAP[admins.role]` เป็น fallback
   → โค้ดไม่พึ่ง backfill อีกต่อไป และ account path จะให้สิทธิ์ไม่น้อยกว่า header path เดิม
2. `0009_backfill_user_roles.sql` เขียน grant ลง DB ให้ชัดเจน

ตรวจว่าหายจริง (หลังรัน 0009):

```sql
-- ต้องได้ 0
SELECT count(*) FROM public.user_accounts ua
 WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.account_id = ua.id);

-- superadmin ต้องเป็น SUPER_ADMIN
SELECT a.admin_id, a.role, ur.role_key
  FROM public.admins a JOIN public.user_roles ur ON ur.account_id = a.account_id
 WHERE a.role = 'superadmin';
```

ทดสอบผ่าน HTTP (ต้องได้ตามนี้เป๊ะ):

| role | GET `/api/admin/products` | POST `/api/admin/products` |
|---|---|---|
| staff | 200 | **403** |
| admin | 200 | 200 |
| superadmin | 200 | 200 |

## 4.3 นักเรียน 3175 ไม่มี account (login ชนกับแอดมิน)

ยืนยันจากข้อมูลจริง: **6 user_accounts จาก 7 profiles**

แอดมิน `ADM-1783669050569` ตั้ง `username = '3175'` ซึ่งชนกับ `student_id` ของธเนศ
`user_accounts.login` เป็น unique ข้าม subject_type ทุกชนิด และ 0002 สร้างฝั่ง admin ก่อน
นักเรียนคนนี้จึงถูกข้าม

**ยังไม่ฉุกเฉิน** — เขายังล็อกอินได้ปกติ เพราะ auth นักเรียนใช้ `student_id` + `student_phone`
ที่ไม่เกี่ยวกับ `user_accounts` สิ่งที่เขาไม่ได้คือ signed session cookie
ดังนั้นต้องแก้ **ก่อนปิด `AUTH_LEGACY_HEADER`** ไม่จำเป็นต้องก่อน deploy

เลือกเปลี่ยน username ของแอดมินแทน `student_id` เพราะรหัสนักเรียนเป็นตัวระบุจริงของสถานศึกษา
และถูกอ้างโดย foreign key 6 ตาราง ส่วน username เป็นแค่ชื่อสำหรับล็อกอิน

ขั้นตอน:

1. เปิด `0010_fix_login_collision.sql` แล้ว**แก้ `CHANGE_ME` ทั้ง 2 จุด** เป็น username ใหม่
   (`^[a-zA-Z0-9_]{3,20}$` และห้ามซ้ำกับ `student_id` ของใครอีก)
2. รัน `0010` — มี guard ที่จะ error ถ้ายังไม่ได้แก้
3. รัน `0002_backfill_accounts.sql` ซ้ำ
4. รัน `0009_backfill_user_roles.sql` ซ้ำ
5. เช็ก SMOKE ท้ายไฟล์ `0010` — `students` ที่ `account_id IS NULL` ต้องเป็น 0 และ `user_accounts` ต้องเป็น 7

**บอกแอดมินคนนั้นด้วยว่า username เปลี่ยนแล้ว** เพราะเขาใช้ล็อกอิน

## 5. ถ้าต้อง rollback

ทุกไฟล์มีบล็อก `-- ROLLBACK:` ท้ายไฟล์ รันย้อนลำดับ `0008` → `0001`
`0002` เป็น data-only — rollback จะล้าง `user_accounts` ทั้งหมดและตั้ง `account_id` เป็น NULL
ไม่มีไฟล์ไหนลบข้อมูลเดิมของระบบ ดังนั้น rollback ไม่ทำให้ข้อมูลนักเรียน/ออเดอร์หาย

ถ้าเสียหายหนักกว่านั้น → restore จาก artifact ในข้อ 1
