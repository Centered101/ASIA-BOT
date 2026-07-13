# คู่มือ Backup & Restore ฐานข้อมูล Supabase

> บทเรียนจากครั้งที่ผ่านมา: **Supabase Free tier ไม่มี backup อัตโนมัติ** ลบโปรเจกต์แล้วหายถาวร
> ทางแก้คือมี backup เก็บไว้ "นอก" Supabase เสมอ — ไฟล์ในโฟลเดอร์นี้จัดการให้แล้ว

## สิ่งที่มีในระบบนี้

| ไฟล์ | หน้าที่ |
|---|---|
| `.github/workflows/backup-db.yml` | สำรองอัตโนมัติทุกวันบน GitHub (ฟรี) เก็บเป็น artifact 90 วัน |
| `scripts/backup-db.ps1` | สำรองด้วยมือลงเครื่อง Windows เมื่อไหร่ก็ได้ |

---

## หา Connection String

Supabase Dashboard → ปุ่ม **Connect** (บนสุด) → เลือกแท็บ **Session pooler**
คัดลอกสตริงหน้าตาแบบนี้ (แทน `[PASSWORD]` ด้วยรหัส DB จริง):

```
postgresql://postgres.[REF]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> ใช้ **Session pooler (พอร์ต 5432)** — ไม่ใช่ Transaction pooler (6543) เพราะ `pg_dump` ต้องการ session mode

---

## 1) สำรองอัตโนมัติ (GitHub Actions) — ตั้งครั้งเดียว

1. ไปที่ repo บน GitHub → **Settings → Secrets and variables → Actions**
2. กด **New repository secret**
   - Name: `SUPABASE_DB_URL`
   - Value: connection string ด้านบน
3. เสร็จ — มันจะรันเองทุกวันตี 2 หรือกดรันเองได้ที่แท็บ **Actions → Supabase DB Backup → Run workflow**
4. โหลดไฟล์ backup ได้จากหน้ารันแต่ละครั้ง (ส่วน **Artifacts**)

## 2) สำรองด้วยมือ (Windows)

```powershell
# ครั้งแรก: ติดตั้ง pg_dump
winget install PostgreSQL.PostgreSQL

# ใส่ SUPABASE_DB_URL=... ลงใน .env.local แล้วรัน
./scripts/backup-db.ps1
```
ไฟล์จะออกมาที่ `backups/backup_YYYY-MM-DD_HHmm.sql.zip` (โฟลเดอร์นี้ถูก gitignore ไว้แล้ว)

---

## กู้คืน (Restore) เข้าโปรเจกต์ใหม่

```powershell
# แตกไฟล์ zip ให้ได้ .sql ก่อน แล้วสั่ง:
psql "postgresql://postgres.[NEW-REF]:[PASSWORD]@...pooler.supabase.com:5432/postgres" -f backup_XXXX.sql
```

หมายเหตุ: dump นี้เก็บทั้ง schema + data ของทุก schema ถ้า restore แล้วชน schema ที่ Supabase จัดการเอง
(`auth`, `storage`) ให้เลือก restore เฉพาะที่ต้องการ หรือ restore เฉพาะ `public`:

```powershell
pg_dump "<DB_URL>" --schema=public --no-owner --no-privileges -f public_only.sql
```

---

## สรุปนิสัยกันพลาด

- ❌ อย่ากด **Delete project** — ถ้าไม่ใช้ชั่วคราวให้ **Pause** แทน
- ✅ แยกโปรเจกต์ **dev / prod** คนละอัน
- ✅ เก็บ `supabase/schema.sql` ใน git (มีอยู่แล้ว)
- ✅ ปล่อยให้ GitHub Actions สำรองทุกวัน + สำรองมือก่อนแก้อะไรใหญ่ๆ
