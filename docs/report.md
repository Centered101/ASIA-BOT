# รายงานโครงงาน
# ASIA-BOT: ระบบบริหารจัดการโรงเรียนแบบครบวงจร

---

| รายละเอียด | ข้อมูล |
|---|---|
| ชื่อโครงงาน | ASIA-BOT — School Management Platform |
| ประเภทโครงงาน | เว็บแอปพลิเคชันสำหรับบริหารจัดการโรงเรียน |
| URL ระบบจริง | https://asia-bot.xyz |
| วันที่จัดทำ | มิถุนายน 2568 |
| ปรับปรุงล่าสุด | กรกฎาคม 2569 |

---

## บทที่ 1 บทนำ

### 1.1 ความเป็นมาและความสำคัญของโครงงาน

ในยุคปัจจุบันที่การศึกษาต้องการความคล่องตัวและความโปร่งใสในการจัดการข้อมูล สถาบันการศึกษาหลายแห่งยังคงพึ่งพาระบบแยกส่วนที่ขาดการเชื่อมต่อกัน ส่งผลให้การดูแลนักเรียน การเช็กชื่อ การจัดการห้องเรียน และการสื่อสารระหว่างผู้ดูแลระบบกับนักเรียนเป็นไปอย่างล่าช้าและไม่มีประสิทธิภาพ

ASIA-BOT ถูกพัฒนาขึ้นเพื่อแก้ปัญหาดังกล่าว โดยรวมระบบย่อยทั้งหมดของโรงเรียนไว้บนแพลตฟอร์มเดียว ตั้งแต่บัตรนักเรียนดิจิทัล ระบบเช็กชื่อด้วย RFID ไปจนถึงสหกรณ์โรงเรียนและการแจ้งเตือนผ่าน LINE

### 1.2 วัตถุประสงค์

1. พัฒนาระบบบริหารจัดการโรงเรียนแบบครบวงจรบนเว็บแอปพลิเคชัน
2. เชื่อมต่ออุปกรณ์ IoT (ESP32 + RFID) เข้ากับระบบฐานข้อมูลผ่าน REST API
3. ส่งการแจ้งเตือนแบบ Real-time ผ่าน LINE Messaging API
4. ออกแบบระบบสิทธิ์ผู้ใช้ (Role-based Access Control) สำหรับหลายระดับ
5. ให้นักเรียนและผู้ดูแลระบบสามารถเข้าถึงข้อมูลได้จากทุกอุปกรณ์
6. พัฒนาผู้ช่วย AI ส่วนกลาง (ASIA-BOT AI) ที่ตอบคำถามและทำงานแทนผู้ใช้ได้ ผ่านทั้งเว็บและ LINE

### 1.3 ขอบเขตของโครงงาน

**ฝั่งซอฟต์แวร์ (Web Application)**
- Next.js 15 App Router พร้อม TypeScript
- Admin Panel แบบ Single-page ควบคุมด้วย query parameter `?tab=`
- REST API สำหรับรับ-ส่งข้อมูลทุกโมดูล
- ระบบ Session สำหรับนักเรียนและผู้ดูแลระบบแยกกัน

**ฝั่ง Hardware (ESP32 Controller)**
- อ่าน RFID UID และส่งข้อมูลผ่าน HTTP
- แสดงผลบนจอ OLED และส่งเสียงผ่าน Buzzer
- รองรับ AP Mode สำหรับตั้งค่าอุปกรณ์

**ฝั่งฐานข้อมูลและ Storage**
- Supabase PostgreSQL สำหรับข้อมูลหลักทั้งหมด
- Supabase Storage สำหรับรูปนักเรียน รูปสินค้า รูป feedback และรูป project

**ฝั่งการสื่อสาร**
- LINE Messaging API สำหรับแจ้งเตือน 5 ประเภทและการส่งข่าวสารจริง

**ฝั่งปัญญาประดิษฐ์ (AI Agent)**
- ผู้ช่วย AI ส่วนกลางขับเคลื่อนด้วย Anthropic Claude แบบ tool-calling
- ใช้ core เดียวกันทั้งเว็บ (ChatBubble) และ LINE webhook
- รองรับทั้งการดูข้อมูลและการทำ action (จองห้อง/ส่ง feedback/ค้นเอกสาร PDF) พร้อม RBAC

---

## บทที่ 2 ทบทวนวรรณกรรม / เทคโนโลยีที่เกี่ยวข้อง

### 2.1 Next.js 15 App Router

Next.js เป็น React Framework ที่รองรับทั้ง Server-side Rendering (SSR) และ Static Site Generation (SSG) App Router ใน Next.js 13+ ใช้แนวคิด React Server Components ซึ่งช่วยลดปริมาณ JavaScript ที่ส่งไปยัง client และเพิ่มประสิทธิภาพการโหลดหน้าเว็บ Route Handlers ของ Next.js ทำหน้าที่เป็น API endpoint ได้โดยตรง ทำให้ไม่ต้องมี backend server แยก

### 2.2 Supabase

Supabase เป็น Backend-as-a-Service แบบ Open Source ที่ใช้ PostgreSQL เป็นฐานข้อมูลหลัก มีระบบ Authentication, Storage, Real-time Subscriptions และ Row Level Security (RLS) ในตัว ช่วยลดเวลาการพัฒนา backend ได้อย่างมีนัยสำคัญ

### 2.3 ESP32 และ RFID (MFRC522)

ESP32 เป็น microcontroller ที่มี WiFi และ Bluetooth ในตัว ราคาเข้าถึงได้ ส่วน MFRC522 เป็น RFID reader ที่สื่อสารผ่าน SPI นิยมใช้ร่วมกับ Arduino/ESP32 ในงาน Access Control และการเช็กชื่อ

### 2.4 LINE Messaging API

LINE Messaging API ช่วยให้พัฒนา Chatbot และการส่งข้อความแบบ Push Message ไปยังกลุ่ม LINE ได้ LINE Flex Message เป็น component ที่ออกแบบหน้าตาข้อความได้อิสระในรูปแบบ JSON ทำให้สื่อสารข้อมูลได้ชัดเจนและมีความน่าสนใจมากกว่าข้อความธรรมดา

### 2.5 Anthropic Claude (AI Agent)

Anthropic Claude เป็น Large Language Model ที่รองรับ **tool-calling** (function calling) ทำให้ AI สามารถเรียกใช้ฟังก์ชันที่กำหนดไว้เพื่อดึงข้อมูลจริงจากฐานข้อมูลและลงมือทำงานแทนผู้ใช้ได้ แทนการตอบจากความรู้ทั่วไปเพียงอย่างเดียว โครงงานนี้ใช้โมเดล `claude-haiku-4-5` ผ่าน `@anthropic-ai/sdk` ออกแบบเป็น agent core ส่วนกลางที่ใช้ร่วมกันได้ทุกช่องทาง

### 2.6 Vercel

Vercel เป็น cloud platform ที่รองรับการ deploy Next.js โดยตรง รองรับ Fluid Compute ที่สามารถรัน Node.js เต็มรูปแบบ มีระบบ Preview Deployments, Analytics และ Edge Network ครอบคลุมทั่วโลก

---

## บทที่ 3 การออกแบบระบบ

### 3.1 สถาปัตยกรรมโดยรวม (System Architecture)

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                      │
│  นักเรียน / Admin (Browser)     ESP32 RFID Device  │
└──────────────┬──────────────────────────┬───────────┘
               │ HTTPS                    │ HTTP POST
               ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              Next.js App Router (Vercel)            │
│  ┌─────────────────┐   ┌────────────────────────┐  │
│  │  Pages / UI     │   │   Route Handlers (API) │  │
│  │  - หน้านักเรียน │   │   - /api/rfid/*        │  │
│  │  - Admin Panel  │   │   - /api/admin/*       │  │
│  │  - Class Track  │   │   - /api/shop/*        │  │
│  │  - Shop / Proj  │   │   - /api/line/*        │  │
│  └─────────────────┘   └────────────────────────┘  │
└────────────────┬────────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      ▼                     ▼
┌──────────────┐   ┌─────────────────┐
│  Supabase    │   │  LINE API       │
│  PostgreSQL  │   │  (Push/Flex)    │
│  Storage     │   │                 │
└──────────────┘   └─────────────────┘
```

### 3.2 โมเดลข้อมูล (Data Model)

ระบบใช้ตารางฐานข้อมูลทั้งสิ้น 16 ตาราง แบ่งตามกลุ่มได้ดังนี้

**กลุ่มนักเรียนและผู้ดูแล**

| ตาราง | หน้าที่ |
|---|---|
| `students` | ข้อมูลหลักของนักเรียนทุกคน รวม UID บัตร RFID |
| `admins` | บัญชีผู้ดูแลระบบ 3 ระดับ (superadmin / admin / staff) |

**กลุ่มการเช็กชื่อ**

| ตาราง | หน้าที่ |
|---|---|
| `attendance` | บันทึกการเข้า-ออกปัจจุบัน (toggle model) |
| `attendance_logs` | ประวัติการสแกนทั้งหมดพร้อม duration |

**กลุ่มการจองห้อง**

| ตาราง | หน้าที่ |
|---|---|
| `rooms` | ข้อมูลห้อง ความจุ amenities สถานะ |
| `time_slots` | ช่วงเวลาจองห้อง |
| `bookings` | คำขอจองห้องพร้อมสถานะอนุมัติ |

**กลุ่มสหกรณ์**

| ตาราง | หน้าที่ |
|---|---|
| `products` | สินค้า ราคา สต็อก |
| `orders` | รายการออเดอร์พร้อม items_json |

**กลุ่มโปรเจกต์**

| ตาราง | หน้าที่ |
|---|---|
| `projects` | โปรเจกต์นักเรียนพร้อม custom_fields |
| `evaluations` | ผลประเมินรายด้านของแต่ละโปรเจกต์ |

**กลุ่มคำขอและ Feedback**

| ตาราง | หน้าที่ |
|---|---|
| `feedback` | ความคิดเห็น / รายงานปัญหา |
| `change_requests` | คำขอแก้ไขข้อมูลนักเรียน |
| `name_change_requests` | คำขอเปลี่ยนชื่อ |

**กลุ่มตารางเรียน**

| ตาราง | หน้าที่ |
|---|---|
| `class_groups` | กลุ่มเรียน แผนก ชั้นปี |
| `teachers` | ข้อมูลครูสำหรับแสดงในตารางเรียน |
| `class_schedules` | ตารางเรียนประจำสัปดาห์ |
| `class_schedule_overrides` | การแก้ไขตารางวันพิเศษ |

### 3.3 การออกแบบระบบสิทธิ์ (Role-based Access Control)

```
Superadmin  ──── จัดการทุกส่วน รวม admin accounts
    │
   Admin  ──────── จัดการข้อมูลหลัก ห้อง ตาราง RFID โปรเจกต์
    │
   Staff  ──────── ดูข้อมูลและใช้งานระบบปฏิบัติการ
    │
  Student ──────── เข้าถึงข้อมูลส่วนตัว จองห้อง ใช้ shop
    │
  Guest  ────────── ดูหน้าแรก โปรเจกต์สาธารณะ class-track-room
```

---

## บทที่ 4 การพัฒนาระบบ

### 4.1 โครงสร้างไฟล์

```
public/                         ← root ของโปรเจกต์
├── src/
│   ├── app/                    ← Next.js App Router pages
│   │   ├── page.tsx            # หน้าแรก
│   │   ├── layout.tsx          # layout หลัก + Analytics
│   │   ├── admin/              # Admin Panel
│   │   ├── api/                # Route Handlers (API)
│   │   │   ├── rfid/           # ESP32 RFID endpoints
│   │   │   ├── admin/          # Admin data endpoints
│   │   │   ├── line/           # LINE webhook / test / broadcast
│   │   │   ├── shop/           # สหกรณ์ endpoints
│   │   │   ├── rooms/          # จองห้อง endpoints
│   │   │   ├── student/        # ข้อมูลนักเรียน
│   │   │   └── projects/       # โปรเจกต์ + evaluation
│   │   ├── class-track-room/   # ติดตามห้องเรียน + จอง
│   │   ├── feedback/           # Feedback / report
│   │   ├── login/              # Student login
│   │   ├── register/           # สมัครนักเรียน
│   │   ├── shop/               # สหกรณ์โรงเรียน
│   │   ├── student/            # โปรไฟล์นักเรียน
│   │   ├── student-entry-scanner/ # ประวัติสแกน
│   │   └── project/[slug]/     # รายละเอียดโปรเจกต์
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── StudentAvatar.tsx
│   │   └── admin/RfidConsole.tsx
│   ├── lib/
│   │   ├── admin-auth.ts       # guard admin session
│   │   ├── session.ts          # student session helpers
│   │   ├── line.ts             # LINE Flex builders
│   │   ├── amenities.ts        # room amenities list
│   │   └── config.ts           # site config / quick links
│   └── types/
│       └── database.ts         # TypeScript types สำหรับ Supabase
├── arduino/
│   └── RFID_ESP32/
│       └── RFID_ESP32.ino      # ESP32 firmware
├── supabase/
│   └── FullSQL.sql             # SQL schema reference
└── docs/
    └── asia-bot-system.drawio  # Architecture + ER Diagram
```

### 4.2 การไหลของข้อมูลหลัก (Main Data Flows)

#### 4.2.1 RFID Attendance Flow

```
นักเรียนแตะบัตร RFID
        ↓
ESP32 อ่าน UID จากบัตร
        ↓
ESP32 POST { uid, location, device_id } → /api/rfid/scan
        ↓
Next.js ค้นหา students โดยใช้ uid
        ↓
ถ้าพบ → บันทึก attendance (toggle check-in / check-out)
ถ้าไม่พบ → ส่งกลับ unknown_card
        ↓
ส่งผลลัพธ์กลับ ESP32
        ↓
ESP32 แสดงชื่อนักเรียนบน OLED + เล่นเสียง Buzzer
```

#### 4.2.2 Room Booking Flow

```
นักเรียน login → เข้า class-track-room
        ↓
ดูสถานะห้องทั้งหมด (ว่าง / ไม่ว่าง / ปิด)
        ↓
เลือกห้อง + ช่วงเวลา + เพิ่มเพื่อน
        ↓
POST /api/rooms/bookings → บันทึกใน bookings (status: pending)
        ↓
LINE Booking Flex → กลุ่ม admin
        ↓
Admin อนุมัติ / ปฏิเสธใน /admin?tab=bookings
        ↓
ห้องเปลี่ยนสถานะในหน้า class-track-room แบบ Real-time
```

#### 4.2.3 Student Data Change Flow

```
นักเรียนแก้ไขข้อมูลในหน้า /student
        ↓
สร้างคำขอใน change_requests (status: pending)
        ↓
LINE Student Data Change Flex → กลุ่ม admin
        ↓
Admin ดูข้อมูลเดิมและข้อมูลใหม่ใน /admin?tab=data_requests
        ↓
อนุมัติ → UPDATE students / ปฏิเสธ → ไม่แก้ไข
```

### 4.3 LINE Flex Message System

ระบบมี Flex Message ทั้งสิ้น 5 แบบสำหรับแจ้งเตือนอัตโนมัติ และอีก 6 แบบสำหรับส่งข่าวสารจริงจากผู้ดูแลระบบ

**Flex แจ้งเตือนอัตโนมัติ**

| Flex | สี Header | ทริกเกอร์ |
|---|---|---|
| Order Flex | `#EC4899` | นักเรียนสั่งซื้อสินค้าสหกรณ์ |
| Feedback Flex | `#84D4FA` / `#FF7070` | นักเรียนส่ง feedback หรือรายงานปัญหา |
| RFID Attendance Flex | `#84D4FA` | นักเรียนสแกนบัตรเข้า-ออก |
| Booking Flex | `#F59E0B` | นักเรียนส่งคำขอจองห้อง |
| Student Data Change Flex | `#6366F1` | นักเรียนยื่นคำขอแก้ไขข้อมูล |

**ข่าวสารจริงจากผู้ดูแล**

| ประเภท | ลักษณะ |
|---|---|
| Text Message | ข้อความธรรมดา |
| Image Message | รูปภาพโดยตรง |
| News Flex | ข่าวสารทั่วไป |
| Urgent Flex | ประกาศด่วน |
| Event Flex | กิจกรรม |
| Notice Flex | แจ้งเตือน |
| Custom JSON | payload ที่ผู้ดูแลเขียนเอง |

### 4.4 AI Agent Core (ASIA-BOT AI)

ผู้ช่วย AI ออกแบบเป็น **core ส่วนกลางตัวเดียว** (`src/lib/agent`) ที่ทั้งเว็บและ LINE เรียกใช้ร่วมกัน ทำงานเป็นวงจร tool-calling

```txt
ผู้ใช้ (เว็บ / LINE)
        │
        ▼
buildContext + system prompt (ตาม role)
        │
        ▼
Claude  ◄────────────┐
   │                 │ (วนสูงสุด 5 รอบ)
   │ ต้องใช้ tool?   │
   ▼ ใช่             │
executeToolCall ──► Supabase (ดูข้อมูล / ทำ action)
   │                 │
   └─────────────────┘
        │ ไม่ใช้แล้ว
        ▼
คำตอบ + richData (การ์ด) + [NAV:] (ปุ่มลิงก์)
```

**องค์ประกอบหลัก**

| ส่วน | หน้าที่ |
|---|---|
| `core.ts` | วงจร tool-calling, รวบรวม richData, บันทึก conversation memory |
| `context.ts` | สร้าง system prompt ตามผู้ใช้/บทบาท/เวลา |
| `tools/` | กลุ่มเครื่องมือ — attendance, booking, shop, schedule, feedback, dashboard, documents |
| `tools/index.ts` | ทะเบียน tool + **RBAC** กำหนดสิทธิ์ต่อ role (least-privilege) |
| `channels/` | แปลง request จากเว็บ/LINE ให้เป็น `AgentRequest` มาตรฐาน |
| `nav.ts` | แปลง `[NAV:/path:label]` เป็นปุ่ม (เว็บ) / quick reply (LINE) |

**ความสามารถระดับ action** — นอกจากดูข้อมูล AI ยังจองห้อง (`create_booking`), ยกเลิกจอง, ส่ง feedback และค้นเอกสาร PDF ได้ โดยตรวจสิทธิ์และยืนยันกับผู้ใช้ก่อนทำงานจริง

### 4.5 ESP32 Hardware

**อุปกรณ์ที่ใช้**

| อุปกรณ์ | รุ่น / Spec |
|---|---|
| Microcontroller | ESP32 DevKit V1 |
| RFID Reader | MFRC522 (SPI) |
| จอแสดงผล | OLED SSD1306 (I2C) |
| เสียง | Passive Buzzer |

**การทำงานสองโหมด**

- **AP Mode**: เปิด WiFi hotspot `ASIA-BOT-Setup` เพื่อตั้งค่า WiFi / backend URL ผ่าน portal ที่ `192.168.4.1` — ไม่มีการส่งข้อมูลไปฐานข้อมูล
- **Online Mode**: เมื่อต่อ WiFi สำเร็จ ส่ง HTTP POST ไป Next.js API ทุกครั้งที่มีการสแกนบัตร

---

## บทที่ 5 ผลการดำเนินงาน

### 5.1 หน้าเว็บที่พัฒนา

**หน้าสำหรับนักเรียน / สาธารณะ**

| URL | รายละเอียด |
|---|---|
| `/` | หน้าแรก — ข้อมูลโรงเรียน ลิงก์ด่วน |
| `/login` | เข้าสู่ระบบด้วยรหัสนักเรียน |
| `/register` | สมัครเป็นนักเรียนใหม่ |
| `/student` | โปรไฟล์นักเรียน บัตรดิจิทัล QR Code แก้ไขข้อมูล |
| `/student-entry-scanner` | ดูประวัติสแกนเข้า-ออกรายวัน |
| `/class-track-room` | สถานะห้องเรียน ตารางวันนี้ จองห้อง |
| `/shop` | สหกรณ์โรงเรียน เลือกซื้อสินค้า |
| `/projects` | รวมโปรเจกต์นักเรียนทั้งหมด |
| `/project/[slug]` | รายละเอียดโปรเจกต์และผลประเมิน |
| `/feedback` | ส่งความคิดเห็นหรือรายงานปัญหา |

**หน้า Admin Panel**

Admin ใช้ path เดียวคือ `/admin?tab=` ตามตาราง:

> **หมายเหตุ:** กลุ่ม "เช็กชื่อ" (`entrylogs`, `checkin_school`, `checkin_library`, `checkin_meeting`, `rfid`) ถูกซ่อนออกจากเมนูฝั่งซ้ายชั่วคราว แต่ tab/route ยังทำงานได้ตามปกติหากเข้าผ่าน URL ตรง

Admin Panel มี global search เปิดด้วย `Ctrl+K` สำหรับค้นหาเมนูและรายการจริง เช่น นักเรียน สินค้า คำสั่งซื้อ คุรุภัณฑ์ และออเดอร์เบิก พร้อม badge แบบ dot number บนเมนูที่มีรายการต้องดู และจำค่า view/filter/search ใน `localStorage` เพื่อให้ผู้ดูแลกลับมาใช้งานต่อได้ง่าย

| Tab | กลุ่ม | หน้าที่ |
|---|---|---|
| `dashboard` | ภาพรวม | สถิตินักเรียน Chart.js สถานะรายวัน |
| `students` | นักเรียน | จัดการนักเรียน รูป card/list/grid |
| `data_requests` | นักเรียน | อนุมัติคำขอแก้ไขข้อมูล |
| `entrylogs` | เช็กชื่อ | บันทึกเข้า-ออกทั้งหมดรายวัน |
| `checkin_school` | เช็กชื่อ | เช็กชื่อโรงเรียน |
| `checkin_library` | เช็กชื่อ | เช็กชื่อห้องสมุด |
| `checkin_meeting` | เช็กชื่อ | เช็กชื่อห้องประชุม |
| `rfid` | เช็กชื่อ | RFID Controller ทดสอบ UID |
| `bookings` | จองห้อง | อนุมัติ/ปฏิเสธคำขอจอง |
| `rooms` | จองห้อง | จัดการห้องและ amenities |
| `products` | สหกรณ์ | จัดการสินค้า |
| `shoporders` | สหกรณ์ | จัดการออเดอร์ |
| `projects` | โปรเจกต์ | จัดการโปรเจกต์และ custom fields |
| `evaluations` | โปรเจกต์ | ผลประเมินและ Chart.js |
| `class_groups` | ตารางเรียน | กลุ่มเรียน |
| `class_schedule_weekly` | ตารางเรียน | ตารางเรียนประจำสัปดาห์ |
| `class_schedule_override` | ตารางเรียน | แก้ไขวันพิเศษ |
| `teachers` | ตารางเรียน | ข้อมูลครูผู้สอน |
| `feedbacks` | ระบบ | จัดการ feedback |
| `admins` | ระบบ | จัดการบัญชี admin |
| `line_broadcast` | ระบบ | ส่งข่าวสาร LINE จริง |
| `settings` | ระบบ | System checklist + LINE Flex test |

### 5.2 เทคโนโลยีและ Stack สรุป

| ด้าน | เทคโนโลยี | เวอร์ชัน |
|---|---|---|
| Frontend Framework | Next.js App Router | 15.x |
| UI Library | React | 19.x |
| ภาษา | TypeScript | 5.8 |
| Styling | Tailwind CSS | 3.x |
| ฐานข้อมูล | Supabase PostgreSQL | — |
| File Storage | Supabase Storage | — |
| Hosting | Vercel | — |
| Analytics | Vercel Analytics | — |
| การแจ้งเตือน | LINE Messaging API | — |
| Chart | Chart.js + react-chartjs-2 | 4.x |
| Animation | AOS (Animate on Scroll) | 2.x |
| Toast | Sonner | 2.x |
| QR Code | qrcode | 1.x |
| Payment | Stripe | 22.x |
| Password | bcryptjs | 3.x |
| Hardware | ESP32 + MFRC522 + OLED | — |

---

## บทที่ 6 สรุปผลและข้อเสนอแนะ

### 6.1 สรุปผลการดำเนินงาน

โครงงาน ASIA-BOT สามารถพัฒนาได้ครบตามวัตถุประสงค์ที่วางไว้ โดยรวมระบบย่อยของโรงเรียน 10 โมดูลหลักไว้บนแพลตฟอร์มเดียว ระบบสามารถใช้งานได้จริงบน URL `https://asia-bot.xyz` ผู้ดูแลระบบสามารถจัดการข้อมูลได้แบบ Real-time และนักเรียนสามารถเข้าถึงข้อมูลส่วนตัว จองห้อง ส่งคำขอ และใช้งานบริการสหกรณ์ได้จากทุกอุปกรณ์

จุดเด่นของโครงงาน:
- **การเชื่อมต่อ IoT** ผ่าน ESP32 RFID ที่ส่งข้อมูลมาบันทึกในฐานข้อมูลได้จริง
- **LINE Integration** ที่ส่งแจ้งเตือนได้ครบทุก event สำคัญโดยไม่ต้องเปิดแอปเพิ่ม
- **Role-based Admin Panel** ที่แบ่งสิทธิ์ชัดเจน 3 ระดับ
- **Performance** ที่ดีจาก Vercel + Supabase และการใช้ Server Components

### 6.2 ปัญหาที่พบและแนวทางแก้ไข

| ปัญหา | แนวทางแก้ไข |
|---|---|
| ESP32 ส่ง request ซ้ำเมื่อ WiFi ไม่เสถียร | เพิ่ม idempotency check ใน API และ debounce ใน firmware |
| Chart.js re-render บ่อยจาก state เปลี่ยน | ใช้ `useMemo` กับ data และ stable key จาก `.join(",")` |
| รูปเก่าค้างใน Supabase Storage | ลบรูปเก่าก่อน upload ใหม่ทุกครั้ง |
| LINE Flex payload ซับซ้อน | แยก builder ออกมาใน `src/lib/line.ts` ชัดเจน |

### 6.3 แนวทางพัฒนาต่อ

1. เพิ่มการแจ้งเตือน Real-time ผ่าน Supabase Realtime Subscriptions
2. พัฒนา Mobile App ด้วย React Native เพื่อประสบการณ์ที่ดีขึ้นบนมือถือ
3. เพิ่มระบบ Push Notification บนเว็บด้วย PWA
4. เชื่อมต่อกับระบบการเงินโรงเรียนผ่าน Stripe Payment
5. เพิ่มหน้า Dashboard Analytics แบบ Advanced พร้อม export รายงาน

---

## ภาคผนวก

### ภาคผนวก ก — Environment Variables

```env
# Site
NEXT_PUBLIC_SITE_NAME=ASIA-BOT
NEXT_PUBLIC_SITE_URL=https://asia-bot.xyz

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin
ADMIN_PASSWORD=optional_env_admin_password
ADMIN_FALLBACK_USERNAME=optional_superadmin_username
ADMIN_FALLBACK_PASSWORD=optional_superadmin_password

# LINE
LINE_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret
LINE_GROUP_ADMIN=Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_GROUP_ATTEND=Cxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# RFID
RFID_STATION_SECRET=optional_station_secret

# Stripe
STRIPE_SECRET_KEY=sk_live_or_test
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_or_test
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### ภาคผนวก ข — API Endpoints หลัก

| Method | Endpoint | หน้าที่ |
|---|---|---|
| POST | `/api/rfid/scan` | รับข้อมูลสแกนจาก ESP32 |
| POST | `/api/rfid/bind` | ผูก UID กับนักเรียน |
| GET | `/api/admin/students` | ดึงรายชื่อนักเรียน |
| POST | `/api/admin/students` | เพิ่มนักเรียน |
| GET | `/api/rooms/bookings` | ดึงรายการจองห้อง |
| POST | `/api/rooms/bookings` | สร้างคำขอจองห้อง |
| POST | `/api/line/test` | ทดสอบ LINE Flex |
| POST | `/api/line/broadcast` | ส่งข่าวสาร LINE จริง |
| POST | `/api/shop/orders` | สร้างออเดอร์ |

### ภาคผนวก ค — RFID Request Example

```http
POST /api/rfid/scan
Content-Type: application/json

{
  "uid": "04B53182D01E90",
  "location": "school",
  "device_id": "ESP32-RFID-01",
  "station_secret": "your-secret"
}
```

Response:
```json
{
  "status": "check_in",
  "student_id": "3130",
  "name": "สมชาย ใจดี",
  "time": "2026-06-18T08:30:00.000Z"
}
```

### ภาคผนวก ง — แผนภาพระบบ

แผนภาพ Architecture และ ER Diagram ฉบับแก้ไขได้อยู่ที่:

```
docs/asia-bot-system.drawio
```

เปิดด้วย [diagrams.net](https://diagrams.net) หรือ VS Code Draw.io Extension

---

*รายงานนี้จัดทำขึ้นเพื่อประกอบการนำเสนอโครงงาน ASIA-BOT ซึ่งเป็นระบบบริหารจัดการโรงเรียนแบบครบวงจร พัฒนาด้วย Next.js 15, Supabase, ESP32 และ LINE Messaging API*

*© 2024–2026 ASIA-BOT. All rights reserved.*
