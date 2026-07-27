# Security Policy

## Supported Versions

ระบบนี้รองรับเฉพาะเวอร์ชันล่าสุดบน branch `main` เท่านั้น

| Version | Supported |
| ------- | --------- |
| main / latest | ✅ |
| older versions | ❌ |

## Reporting a Vulnerability

หากพบช่องโหว่ด้านความปลอดภัย กรุณาแจ้งผู้ดูแลโดยตรงผ่าน GitHub Security Advisory หรือช่องทางส่วนตัวของผู้ดูแล repository

กรุณาอย่าเปิดเผยข้อมูลต่อสาธารณะก่อนที่ทีมผู้ดูแลจะตรวจสอบและแก้ไขเสร็จ

ข้อมูลที่ควรแนบมาด้วย:

- รายละเอียดช่องโหว่
- ขั้นตอนที่ทำให้เกิดปัญหา
- URL หรือหน้าที่เกี่ยวข้อง
- ภาพหน้าจอหรือ log ถ้ามี
- ผลกระทบที่อาจเกิดขึ้น

## Response Timeline

- รับเรื่องภายใน 3 วัน
- ตรวจสอบและประเมินความเสี่ยงภายใน 7 วัน
- แก้ไขโดยเร็วตามระดับความรุนแรง

## Scope

อยู่ในขอบเขต:

- ระบบ login นักเรียนและผู้ดูแล
- Admin panel
- Supabase API / database access
- LINE webhook / notification
- Payment / shop order flow
- File upload และ storage
- AI chat ที่เข้าถึงข้อมูลผู้ใช้

อยู่นอกขอบเขต:

- การโจมตีแบบ spam หรือ DDoS
- social engineering
- ปัญหาจาก browser extension หรือเครื่องผู้ใช้
- ช่องโหว่ที่เกิดจากการเปิดเผย secret โดยผู้ใช้เอง

## Secrets

ห้ามส่ง secret, token, database URL, private key หรือรหัสผ่านจริงใน issue สาธารณะ

หากพบ secret หลุด ให้แจ้งแบบ private ทันที และผู้ดูแลควร rotate key ที่เกี่ยวข้อง
