import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "เราเก็บข้อมูลอะไรบ้าง",
    items: [
      "ข้อมูลนักเรียน เช่น รหัสนักเรียน ชื่อ นามสกุล ชื่อเล่น ระดับชั้น สาขา ปีที่เข้าเรียน และรูปโปรไฟล์",
      "ข้อมูลการใช้งานระบบ เช่น การจองห้อง คำขอเบิกคุรุภัณฑ์ คำสั่งซื้อสหกรณ์ การประเมินโปรเจกต์ และความคิดเห็นที่ส่งเข้ามา",
      "ข้อมูลใบสมัครครูหรือข้อมูลบุคลากร เมื่อผู้ใช้ส่งแบบฟอร์มสมัครหรือผู้ดูแลบันทึกข้อมูลครูผู้สอน",
      "ข้อมูลบัญชีที่ใช้เข้าสู่ระบบ เช่น เบอร์โทรสำหรับยืนยันตัวตน หรืออีเมล Google เมื่อผู้ใช้เลือกเชื่อมบัญชี",
      "ข้อมูลสำหรับแจ้งเตือน เช่น LINE user id หรือข้อมูลที่จำเป็นต่อการส่งข้อความแจ้งเตือน",
      "ข้อความที่ผู้ใช้ส่งให้ ASIA-BOT AI เพื่อให้ระบบตอบคำถามหรือช่วยดำเนินงานตามคำขอ",
    ],
  },
  {
    title: "เราใช้ข้อมูลเพื่ออะไร",
    items: [
      "ยืนยันตัวตนและแสดงบัตรประจำตัวนักเรียน",
      "ดูแลและตรวจสอบการใช้งานบริการของโรงเรียน",
      "จัดการการจองห้อง คำขอเบิกคุรุภัณฑ์ คำสั่งซื้อสินค้า การประเมินโปรเจกต์ และการติดต่อกลับจากผู้ดูแล",
      "ตรวจสอบใบสมัครครู จัดการข้อมูลครูผู้สอน และดูแลตารางเรียน",
      "ปรับปรุงความปลอดภัยของระบบ และตรวจสอบการใช้งานที่ผิดปกติ",
      "ส่งการแจ้งเตือนที่เกี่ยวข้องกับบัญชีหรือกิจกรรมของผู้ใช้",
      "ช่วยให้ ASIA-BOT AI ตอบคำถามตามข้อมูลที่ผู้ใช้มีสิทธิ์เข้าถึงเท่านั้น",
    ],
  },
  {
    title: "ใครเข้าถึงข้อมูลได้",
    items: [
      "นักเรียนสามารถดูข้อมูลของตนเองได้ในหน้าบัตรนักเรียน",
      "ผู้ดูแลระบบสามารถดูและจัดการข้อมูลที่จำเป็นต่อการให้บริการ",
      "ข้อมูลบางส่วนอาจถูกใช้กับบริการภายนอกที่จำเป็น เช่น Supabase, Google OAuth, Vercel, LINE Messaging API, ระบบชำระเงิน หรือผู้ให้บริการ AI",
      "เราไม่ขายข้อมูลส่วนบุคคลของผู้ใช้",
    ],
  },
  {
    title: "การเก็บรักษาและความปลอดภัย",
    items: [
      "ระบบใช้สิทธิ์ผู้ดูแลเพื่อจำกัดการเข้าถึงข้อมูลสำคัญ",
      "การทำงานสำคัญของผู้ดูแลอาจถูกบันทึกเพื่อตรวจสอบย้อนหลัง",
      "รูปโปรไฟล์จะถูกครอปเป็นอัตราส่วน 1:1 ก่อนนำไปใช้แสดงผลในระบบ",
      "ผู้ใช้ควรรักษารหัสผ่าน เบอร์โทร และบัญชี Google ของตนเองให้ปลอดภัย",
      "หากพบข้อมูลผิดพลาดหรือสงสัยว่าบัญชีถูกใช้งานโดยไม่ได้รับอนุญาต ควรแจ้งผู้ดูแลทันที",
    ],
  },
  {
    title: "สิทธิ์ของผู้ใช้",
    items: [
      "ขอดูข้อมูลของตนเองได้จากหน้าบัตรนักเรียน",
      "แก้ไขรูปโปรไฟล์ ชื่อเล่น และเบอร์โทรได้ตามสิทธิ์ของระบบ",
      "ส่งคำขอแก้ไขข้อมูลสำคัญผ่านระบบได้ โดยข้อมูลบางประเภทต้องรอผู้ดูแลอนุมัติ",
      "ขอให้ผู้ดูแลตรวจสอบ ลบ หรือปิดการใช้งานข้อมูลบางส่วนได้ตามความเหมาะสมของระบบโรงเรียน",
      "ยกเลิกการเชื่อมบัญชี Google หรือ LINE ได้โดยติดต่อผู้ดูแลระบบ",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#FF7070", bottom: -110, left: -130 }} />
      <Header subtitle="นโยบายความเป็นส่วนตัว" />

      <main className="min-h-screen max-w-4xl mx-auto px-3 sm:px-6 pt-10 pb-16 relative z-10">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 backdrop-blur-xs shadow-[0_18px_50px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="relative p-5 sm:p-8 border-b border-slate-100">
            <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary-color)]" />
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--primary-color)] bg-white text-[var(--primary-dark)] shadow-[0_8px_24px_rgba(132,212,250,0.22)]">
                <i className="fa-solid fa-shield-halved" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">นโยบายความเป็นส่วนตัว</h1>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  หน้านี้อธิบายว่า ASIA-BOT เก็บ ใช้ และดูแลข้อมูลของผู้ใช้อย่างไร โดยเขียนให้เข้าใจง่ายสำหรับนักเรียน ผู้ปกครอง และบุคลากร
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-400">อัปเดตล่าสุด: 9 สิงหาคม 2569</p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 space-y-6">
            {sections.map(section => (
              <section key={section.title}>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-800 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary-color)]" />
                  {section.title}
                </h2>
                <ul className="mt-3 space-y-2.5">
                  {section.items.map(item => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-slate-600">
                      <i className="fa-solid fa-check text-[10px] mt-1.5 text-[var(--primary-dark)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">ติดต่อผู้ดูแล:</strong> หากต้องการแก้ไข ลบ หรือตรวจสอบข้อมูลส่วนตัว กรุณาติดต่อผู้ดูแลระบบของ ASIA-BOT ผ่านช่องทางของโรงเรียนหรือหน้าแสดงความคิดเห็น
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
