import Anthropic from "@anthropic-ai/sdk";

type Student = {
  student_id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  program: string;
  department: string | null;
};

export async function replyWithAI(student: Student, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "ขอโทษครับ ระบบ AI ยังไม่พร้อมใช้งาน กรุณาลองอีกครั้งในภายหลัง";

  const client = new Anthropic({ apiKey });

  const systemPrompt = [
    `คุณคือ ASIA-BOT ผู้ช่วยอัจฉริยะของโรงเรียน ASIA เทคโนโลยีและนวัตกรรม`,
    `นักเรียนที่คุยด้วย: ${student.first_name} ${student.last_name}${student.nickname ? ` (${student.nickname})` : ""}`,
    `ชั้น/หลักสูตร: ${student.program}${student.department ? ` · ${student.department}` : ""}`,
    `รหัสนักเรียน: ${student.student_id}`,
    ``,
    `กฎ:`,
    `- ตอบเป็นภาษาไทย กระชับ เป็นมิตร ไม่เกิน 3-4 ประโยค`,
    `- ถ้านักเรียนถามเรื่องที่ bot ทำได้ (สถานะ/ตาราง/การจอง/ออเดอร์/ฟีดแบ็ก) ให้บอกว่าพิมพ์คำสั่งนั้นได้เลย`,
    `- ห้ามสร้างข้อมูลเท็จเกี่ยวกับโรงเรียน`,
    `- ถ้าตอบไม่ได้ ให้บอกว่า "ลองติดต่อทีมงานโรงเรียนโดยตรงครับ/ค่ะ"`,
  ].join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text : "ขอโทษครับ ไม่เข้าใจคำถาม ลองพิมพ์ 'ช่วยเหลือ' เพื่อดูคำสั่งที่ใช้ได้";
  } catch {
    return "ขอโทษครับ ระบบ AI มีปัญหาชั่วคราว ลองพิมพ์ 'ช่วยเหลือ' เพื่อดูคำสั่งที่ใช้ได้";
  }
}
