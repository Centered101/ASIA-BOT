import Header from "@/components/Header";
import Footer from "@/components/Footer";

const sections = [
  {
    title: "การใช้งานระบบ",
    items: [
      "ผู้ใช้ควรใช้ระบบ ASIA-BOT เพื่อการเรียน การจัดการห้องเรียน การเช็กชื่อ การจองห้อง สหกรณ์ และงานที่เกี่ยวข้องกับโรงเรียนเท่านั้น",
      "ข้อมูลที่กรอกควรเป็นข้อมูลจริง ถูกต้อง และเป็นปัจจุบัน",
      "ห้ามใช้บัญชีของผู้อื่น หรือแอบอ้างเป็นนักเรียน ผู้ดูแล หรือบุคคลอื่น",
      "ห้ามรบกวนระบบ ส่งข้อมูลเท็จ สแปม หรือกระทำการที่ทำให้ระบบเสียหาย",
    ],
  },
  {
    title: "บัญชีผู้ใช้และความปลอดภัย",
    items: [
      "นักเรียนมีหน้าที่ดูแลรหัสนักเรียน เบอร์โทร และบัญชี Google ที่ใช้เข้าสู่ระบบ",
      "หากสงสัยว่ามีผู้อื่นเข้าใช้บัญชี ควรแจ้งผู้ดูแลทันที",
      "ผู้ดูแลระบบมีสิทธิ์ตรวจสอบ ระงับ หรือปิดบัญชีที่มีความเสี่ยงต่อความปลอดภัย",
      "การทำงานสำคัญ เช่น การแก้ไขข้อมูล การอนุมัติคำขอ หรือการลบข้อมูล อาจถูกบันทึกเพื่อความปลอดภัย",
    ],
  },
  {
    title: "ข้อมูลและเนื้อหาที่ผู้ใช้ส่ง",
    items: [
      "ผู้ใช้ต้องรับผิดชอบข้อความ รูปภาพ ความคิดเห็น รายงานปัญหา และข้อมูลที่ส่งเข้าระบบ",
      "ห้ามส่งข้อมูลที่ละเมิดสิทธิ์ผู้อื่น สร้างความเสียหาย หรือไม่เหมาะสมกับสถานศึกษา",
      "ผู้ดูแลสามารถลบหรือซ่อนข้อมูลที่ไม่เหมาะสมได้",
      "ข้อมูลที่ส่งเข้าระบบอาจถูกใช้เพื่อแก้ปัญหา ติดต่อกลับ หรือปรับปรุงบริการ",
    ],
  },
  {
    title: "การจองห้องและสหกรณ์",
    items: [
      "การจองห้องต้องใช้เพื่อกิจกรรมที่เหมาะสม และควรระบุข้อมูลให้ครบถ้วน",
      "ผู้ดูแลสามารถอนุมัติ ปฏิเสธ หรือยกเลิกการจองได้ตามความเหมาะสม",
      "คำสั่งซื้อสหกรณ์ต้องตรวจสอบรายการและยอดชำระก่อนยืนยัน",
      "หลักฐานการชำระเงินหรือใบเสร็จควรเก็บไว้จนกว่ารายการจะเสร็จสมบูรณ์",
    ],
  },
  {
    title: "ข้อจำกัดของระบบ",
    items: [
      "ระบบอาจมีการปรับปรุง ปิดปรับปรุง หรือเกิดเหตุขัดข้องเป็นบางช่วง",
      "ข้อมูลแบบใกล้เคียงเวลาจริงอาจล่าช้าได้ตามสภาพเครือข่ายหรือบริการภายนอก",
      "ASIA-BOT จะพยายามดูแลระบบให้ใช้งานได้ต่อเนื่อง แต่ไม่สามารถรับประกันว่าจะไม่มีข้อผิดพลาดเลย",
      "หากพบปัญหา ผู้ใช้ควรแจ้งผ่านหน้าแสดงความคิดเห็นหรือแจ้งผู้ดูแล",
    ],
  },
  {
    title: "การเปลี่ยนแปลงเงื่อนไข",
    items: [
      "เงื่อนไขการใช้งานอาจมีการปรับปรุงให้เหมาะสมกับการใช้งานจริง",
      "เมื่อมีการเปลี่ยนแปลงสำคัญ ระบบอาจแจ้งให้ผู้ใช้ทราบผ่านหน้าเว็บหรือช่องทางของโรงเรียน",
      "การใช้งานระบบต่อหลังจากมีการปรับปรุง ถือว่าผู้ใช้ยอมรับเงื่อนไขล่าสุด",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <div className="bg-blob" style={{ width: 520, height: 520, background: "var(--primary-color)", top: -120, right: -170 }} />
      <div className="bg-blob" style={{ width: 420, height: 420, background: "#FF7070", bottom: -110, left: -130 }} />
      <Header subtitle="เงื่อนไขการใช้งาน" />

      <main className="min-h-screen max-w-4xl mx-auto px-3 sm:px-6 pt-10 pb-16 relative z-10">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white/90 backdrop-blur-sm shadow-[0_18px_50px_rgba(15,23,42,0.06)] overflow-hidden">
          <div className="relative p-5 sm:p-8 border-b border-slate-100">
            <div className="absolute inset-x-0 top-0 h-1 bg-[var(--primary-color)]" />
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[var(--primary-color)] bg-white text-[var(--primary-dark)] shadow-[0_8px_24px_rgba(132,212,250,0.22)]">
                <i className="fa-solid fa-file-signature" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">เงื่อนไขการใช้งาน</h1>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  เงื่อนไขนี้ช่วยให้ทุกคนใช้งาน ASIA-BOT ได้อย่างปลอดภัย เป็นธรรม และเหมาะสมกับการใช้งานในสถานศึกษา
                </p>
                <p className="mt-3 text-xs font-semibold text-slate-400">อัปเดตล่าสุด: 6 มิถุนายน 2569</p>
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
                      <i className="fa-solid fa-circle-check text-[11px] mt-1 text-[var(--primary-dark)]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">หมายเหตุ:</strong> หากพบการใช้งานที่ไม่เหมาะสม ผู้ดูแลระบบอาจจำกัดสิทธิ์การใช้งานชั่วคราวหรือถาวรเพื่อปกป้องผู้ใช้และข้อมูลของโรงเรียน
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
