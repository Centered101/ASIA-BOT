"use client";

export default function AsiaBotPresentation() {
  const slides = [
    { id: 1, title: "หน้าปก" },
    { id: 2, title: "สมาชิกกลุ่ม" },
    { id: 3, title: "ที่มาและความสำคัญ" },
    { id: 4, title: "วัตถุประสงค์" },
    { id: 5, title: "ขั้นตอนการทำงาน / อุปกรณ์" },
    { id: 6, title: "ประโยชน์" },
    { id: 7, title: "งบประมาณ" },
    { id: 8, title: "องค์ประกอบเพิ่มเติม" },
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main
      style={{
        fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
        background: "#0a0a1a",
        minHeight: "100vh",
        color: "#fff",
      }}
    >
      {/* NAV */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(10,10,26,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid #84D4FA33",
          display: "flex",
          gap: "0.5rem",
          padding: "0.6rem 1.5rem",
          flexWrap: "wrap",
        }}
      >
        {slides.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(`slide-${s.id}`)}
            style={{
              background: "none",
              border: "1px solid #84D4FA55",
              color: "#84D4FA",
              borderRadius: "999px",
              padding: "0.25rem 0.75rem",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </nav>

      <div style={{ paddingTop: "60px" }}>
        {/* SLIDE 1 — COVER */}
        <section
          id="slide-1"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "2rem",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "600px",
              height: "600px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #84D4FA22 0%, transparent 70%)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: "300px",
              height: "300px",
              borderRadius: "50%",
              background:
                "radial-gradient(circle, #FF707022 0%, transparent 70%)",
              top: "30%",
              right: "15%",
            }}
          />

          <div
            style={{
              border: "2px solid #84D4FA",
              borderRadius: "1rem",
              padding: "0.4rem 1.5rem",
              fontSize: "0.85rem",
              color: "#84D4FA",
              letterSpacing: "0.2em",
              marginBottom: "1.5rem",
              textTransform: "uppercase",
            }}
          >
            โครงงานวิทยาศาสตร์ / นวัตกรรม
          </div>

          <h1
            style={{
              fontSize: "clamp(3rem, 10vw, 7rem)",
              fontWeight: 900,
              margin: 0,
              background: "linear-gradient(135deg, #84D4FA 30%, #FF7070 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "0.05em",
            }}
          >
            ASIA-BOT
          </h1>

          <p
            style={{
              fontSize: "1.2rem",
              color: "#ccc",
              maxWidth: "600px",
              marginTop: "1rem",
              lineHeight: 1.8,
            }}
          >
            ผู้ช่วยอัจฉริยะอาเซียน — ระบบแชทบอทให้ข้อมูลประเทศในภูมิภาคอาเซียน
            ด้วยปัญญาประดิษฐ์
          </p>

          <div
            style={{
              marginTop: "3rem",
              display: "flex",
              gap: "2rem",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {[
              { label: "สมาชิก", value: "4 คน" },
              { label: "ระยะเวลา", value: "3 เดือน" },
              { label: "ประเภท", value: "AI & Chatbot" },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: "#ffffff08",
                  border: "1px solid #84D4FA33",
                  borderRadius: "0.75rem",
                  padding: "1rem 1.5rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{ fontSize: "1.5rem", fontWeight: 700, color: "#84D4FA" }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#aaa" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SLIDE 2 — MEMBERS */}
        <section id="slide-2" style={sectionStyle()}>
          <SlideHeader num="01" title="สมาชิกกลุ่ม" accent="#84D4FA" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "1.5rem",
              maxWidth: "900px",
              margin: "0 auto",
            }}
          >
            {[
              {
                no: "01",
                name: "นาย พงศ์พล พรมผา",
                role: "หัวหน้าโครงงาน / Developer",
                color: "#84D4FA",
              },
              {
                no: "02",
                name: "นาย ธเนต สีแดง",
                role: "นักออกแบบระบบ / AI Trainer",
                color: "#FF7070",
              },
              {
                no: "03",
                name: "นางสาว ____________",
                role: "ผู้รวบรวมข้อมูล / Researcher",
                color: "#84D4FA",
              },
              {
                no: "04",
                name: "นางสาว ____________",
                role: "ผู้จัดทำเอกสาร / Presenter",
                color: "#FF7070",
              },
            ].map((m) => (
              <MemberCard key={m.no} {...m} />
            ))}
          </div>
        </section>

        {/* SLIDE 3 — BACKGROUND */}
        <section id="slide-3" style={sectionStyle("#84D4FA0a")}>
          <SlideHeader num="02" title="ที่มาและความสำคัญ" accent="#FF7070" />

          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <div
              style={{
                background: "#ffffff06",
                border: "1px solid #FF707044",
                borderRadius: "1rem",
                padding: "2rem",
                lineHeight: 2.2,
                fontSize: "1.05rem",
                color: "#ddd",
              }}
            >
              <p style={{ margin: "0 0 1rem" }}>
                ปัจจุบันประเทศในภูมิภาค{" "}
                <Highlight color="#84D4FA">อาเซียน 10 ประเทศ</Highlight>{" "}
                มีความสัมพันธ์ทางเศรษฐกิจ วัฒนธรรม และการศึกษา
                ที่ใกล้ชิดกันมากขึ้นเรื่อยๆ แต่นักเรียนและประชาชนทั่วไป
                ยังขาดช่องทางที่สะดวกในการ{" "}
                <Highlight color="#84D4FA">เข้าถึงข้อมูล</Highlight>{" "}
                ของแต่ละประเทศในภาษาไทยแบบทันที
              </p>
              <p style={{ margin: "0 0 1rem" }}>
                โครงงาน <Highlight color="#FF7070">ASIA-BOT</Highlight>{" "}
                จึงถูกพัฒนาขึ้นเพื่อเป็น{" "}
                <Highlight color="#84D4FA">
                  ผู้ช่วยอัจฉริยะด้านข้อมูลอาเซียน
                </Highlight>{" "}
                ที่ตอบคำถามได้ทันที ถูกต้อง และเข้าใจง่าย
              </p>
              <p style={{ margin: 0 }}>
                ระบบนี้มีความสำคัญต่อ{" "}
                <Highlight color="#FF7070">การศึกษาระดับมัธยมศึกษา</Highlight>{" "}
                เพราะช่วยให้นักเรียนสามารถค้นหาข้อมูลประเทศเพื่อนบ้านได้ง่ายขึ้น
                และส่งเสริมความรู้ความเข้าใจในประชาคมอาเซียน
              </p>
            </div>
          </div>
        </section>

        {/* SLIDE 4 — OBJECTIVES */}
        <section id="slide-4" style={sectionStyle()}>
          <SlideHeader num="03" title="วัตถุประสงค์" accent="#84D4FA" />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              maxWidth: "750px",
              margin: "0 auto",
            }}
          >
            {[
              {
                n: "1",
                text: "เพื่อพัฒนาระบบแชทบอทที่สามารถให้ข้อมูลประเทศในอาเซียน 10 ประเทศ ได้อย่างถูกต้องและครบถ้วน",
                color: "#84D4FA",
              },
              {
                n: "2",
                text: "เพื่อส่งเสริมการเรียนรู้เรื่องอาเซียนในกลุ่มนักเรียนระดับมัธยมศึกษาผ่านเทคโนโลยีปัญญาประดิษฐ์",
                color: "#FF7070",
              },
              {
                n: "3",
                text: "เพื่อออกแบบอินเทอร์เฟซที่ใช้งานง่าย รองรับภาษาไทย และเข้าถึงได้บนทุกอุปกรณ์",
                color: "#84D4FA",
              },
              {
                n: "4",
                text: "เพื่อประเมินความพึงพอใจและความถูกต้องของข้อมูลที่ระบบให้บริการกับผู้ใช้จริง",
                color: "#FF7070",
              },
            ].map((obj) => (
              <ObjectiveRow key={obj.n} {...obj} />
            ))}
          </div>
        </section>

        {/* SLIDE 5 — STEPS & EQUIPMENT */}
        <section id="slide-5" style={sectionStyle("#FF70700a")}>
          <SlideHeader num="04" title="ขั้นตอนการทำงาน / อุปกรณ์" accent="#FF7070" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2rem",
              maxWidth: "900px",
              margin: "0 auto",
            }}
          >
            {/* Steps */}
            <div>
              <h3
                style={{
                  color: "#84D4FA",
                  fontSize: "1rem",
                  marginBottom: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                ขั้นตอนการทำงาน
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
              >
                {[
                  "ศึกษาข้อมูลและวิเคราะห์ความต้องการ",
                  "รวบรวมฐานข้อมูลอาเซียน 10 ประเทศ",
                  "ออกแบบโครงสร้างแชทบอทและ UI",
                  "พัฒนาระบบด้วย Next.js + AI API",
                  "ทดสอบและปรับปรุงความแม่นยำ",
                  "ประเมินผลและสรุปโครงงาน",
                ].map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                    }}
                  >
                    <span
                      style={{
                        minWidth: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: "#84D4FA",
                        color: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                      }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: "#ddd", lineHeight: 1.7, fontSize: "0.95rem" }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <h3
                style={{
                  color: "#FF7070",
                  fontSize: "1rem",
                  marginBottom: "1rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                อุปกรณ์ / เครื่องมือ
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
              >
                {[
                  { name: "คอมพิวเตอร์โน้ตบุ๊ก", note: "พัฒนาและทดสอบระบบ" },
                  { name: "Next.js + React", note: "Framework สำหรับ Frontend" },
                  { name: "OpenAI / Claude API", note: "ระบบประมวลผลภาษา AI" },
                  { name: "VS Code", note: "โปรแกรมเขียนโค้ด" },
                  { name: "GitHub", note: "จัดการเวอร์ชันโค้ด" },
                  { name: "Vercel", note: "Deploy โปรเจกต์ออนไลน์" },
                ].map((eq) => (
                  <div
                    key={eq.name}
                    style={{
                      background: "#ffffff06",
                      border: "1px solid #FF707033",
                      borderRadius: "0.5rem",
                      padding: "0.5rem 0.75rem",
                    }}
                  >
                    <span style={{ color: "#FF7070", fontWeight: 600, fontSize: "0.9rem" }}>
                      {eq.name}
                    </span>
                    <span style={{ color: "#888", fontSize: "0.8rem" }}>
                      {" — "}
                      {eq.note}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SLIDE 6 — BENEFITS */}
        <section id="slide-6" style={sectionStyle()}>
          <SlideHeader num="05" title="ประโยชน์ที่คาดว่าจะได้รับ" accent="#84D4FA" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1.25rem",
              maxWidth: "900px",
              margin: "0 auto",
            }}
          >
            {[
              {
                icon: "🎓",
                title: "ด้านการศึกษา",
                desc: "นักเรียนสามารถค้นหาข้อมูลอาเซียนได้สะดวกรวดเร็วในภาษาไทย",
                color: "#84D4FA",
              },
              {
                icon: "🤖",
                title: "ด้านเทคโนโลยี",
                desc: "ประยุกต์ใช้ AI สมัยใหม่ในการพัฒนาระบบที่มีประโยชน์ต่อสังคม",
                color: "#FF7070",
              },
              {
                icon: "🌏",
                title: "ด้านความสัมพันธ์อาเซียน",
                desc: "เสริมสร้างความเข้าใจระหว่างประเทศในภูมิภาคอาเซียน",
                color: "#84D4FA",
              },
              {
                icon: "💡",
                title: "ด้านนวัตกรรม",
                desc: "เป็นต้นแบบสำหรับพัฒนาต่อยอดเป็นแพลตฟอร์มการเรียนรู้ที่ใหญ่ขึ้น",
                color: "#FF7070",
              },
            ].map((b) => (
              <BenefitCard key={b.title} {...b} />
            ))}
          </div>
        </section>

        {/* SLIDE 7 — BUDGET */}
        <section id="slide-7" style={sectionStyle("#84D4FA0a")}>
          <SlideHeader num="06" title="งบประมาณ" accent="#FF7070" />

          <div style={{ maxWidth: "750px", margin: "0 auto" }}>
            <div
              style={{
                background: "#ffffff06",
                border: "1px solid #84D4FA33",
                borderRadius: "1rem",
                overflow: "hidden",
              }}
            >
              {/* Table Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 2fr",
                  background: "#84D4FA15",
                  padding: "0.75rem 1.25rem",
                  gap: "1rem",
                  borderBottom: "1px solid #84D4FA33",
                }}
              >
                {["ชื่ออุปกรณ์ / รายการ", "ราคา (บาท)", "ใช้สำหรับ"].map(
                  (h) => (
                    <span
                      key={h}
                      style={{
                        color: "#84D4FA",
                        fontWeight: 700,
                        fontSize: "0.85rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </span>
                  )
                )}
              </div>

              {/* Rows */}
              {[
                {
                  item: "OpenAI API Credit",
                  price: "700",
                  use: "ระบบประมวลผลภาษาธรรมชาติ (NLP)",
                },
                {
                  item: "Vercel Pro (1 เดือน)",
                  price: "700",
                  use: "Hosting และ Deploy โปรเจกต์",
                },
                {
                  item: "Domain Name (.com)",
                  price: "500",
                  use: "ชื่อโดเมนสำหรับเว็บไซต์",
                },
                {
                  item: "Flash Drive 32 GB",
                  price: "250",
                  use: "สำรองข้อมูลและนำเสนอ",
                },
                {
                  item: "ค่าเอกสาร / พิมพ์",
                  price: "300",
                  use: "จัดทำรายงานและโปสเตอร์",
                },
                {
                  item: "อื่นๆ (สำรอง)",
                  price: "550",
                  use: "ค่าใช้จ่ายที่ไม่คาดคิด",
                },
              ].map((row, i) => (
                <div
                  key={row.item}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 2fr",
                    padding: "0.75rem 1.25rem",
                    gap: "1rem",
                    borderBottom:
                      i < 5 ? "1px solid #ffffff0a" : "none",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#fff", fontSize: "0.9rem" }}>
                    {row.item}
                  </span>
                  <span
                    style={{
                      color: "#FF7070",
                      fontWeight: 700,
                      fontSize: "0.95rem",
                    }}
                  >
                    {row.price}
                  </span>
                  <span style={{ color: "#aaa", fontSize: "0.82rem" }}>
                    {row.use}
                  </span>
                </div>
              ))}

              {/* Total */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 2fr",
                  padding: "1rem 1.25rem",
                  gap: "1rem",
                  background: "#FF707015",
                  borderTop: "2px solid #FF707044",
                }}
              >
                <span
                  style={{ color: "#fff", fontWeight: 700, fontSize: "1rem" }}
                >
                  รวมทั้งหมด
                </span>
                <span
                  style={{
                    color: "#FF7070",
                    fontWeight: 900,
                    fontSize: "1.1rem",
                  }}
                >
                  3,000
                </span>
                <span style={{ color: "#aaa", fontSize: "0.85rem" }}>
                  บาท (ประมาณการ)
                </span>
              </div>
            </div>

            <p
              style={{
                textAlign: "center",
                color: "#666",
                fontSize: "0.8rem",
                marginTop: "0.75rem",
              }}
            >
              * ราคาอาจเปลี่ยนแปลงตามความเหมาะสมและงบที่ได้รับการอนุมัติ
            </p>
          </div>
        </section>

        {/* SLIDE 8 — EXTRAS */}
        <section id="slide-8" style={sectionStyle()}>
          <SlideHeader num="07" title="องค์ประกอบเพิ่มเติม" accent="#84D4FA" />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "1.25rem",
              maxWidth: "900px",
              margin: "0 auto",
            }}
          >
            {[
              {
                icon: "📊",
                title: "การประเมินผล",
                color: "#84D4FA",
                items: [
                  "แบบสอบถามความพึงพอใจ",
                  "ทดสอบความแม่นยำของคำตอบ",
                  "เก็บข้อมูลสถิติการใช้งาน",
                ],
              },
              {
                icon: "🔒",
                title: "ความปลอดภัย",
                color: "#FF7070",
                items: [
                  "ไม่เก็บข้อมูลส่วนตัวของผู้ใช้",
                  "ระบบ Content Filter สำหรับ AI",
                  "HTTPS & Secure Deployment",
                ],
              },
              {
                icon: "🚀",
                title: "แผนพัฒนาต่อยอด",
                color: "#84D4FA",
                items: [
                  "เพิ่มรองรับภาษาอังกฤษ",
                  "เพิ่ม Quiz / ทดสอบความรู้",
                  "รองรับเป็น Mobile App",
                ],
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  background: "#ffffff06",
                  border: `1px solid ${card.color}44`,
                  borderRadius: "1rem",
                  padding: "1.5rem",
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
                  {card.icon}
                </div>
                <h3
                  style={{
                    color: card.color,
                    margin: "0 0 1rem",
                    fontSize: "1rem",
                  }}
                >
                  {card.title}
                </h3>
                <ul
                  style={{
                    margin: 0,
                    padding: "0 0 0 1rem",
                    color: "#ccc",
                    lineHeight: 2,
                    fontSize: "0.9rem",
                  }}
                >
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Closing */}
          <div
            style={{
              textAlign: "center",
              marginTop: "4rem",
              padding: "2rem",
              borderTop: "1px solid #84D4FA22",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                background:
                  "linear-gradient(135deg, #84D4FA 30%, #FF7070 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                margin: 0,
              }}
            >
              ASIA-BOT
            </h2>
            <p style={{ color: "#666", marginTop: "0.5rem" }}>
              ขอบคุณคณะกรรมการทุกท่าน
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ─── Helper Components ─── */

function sectionStyle(bg?: string): React.CSSProperties {
  return {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    padding: "5rem 2rem 3rem",
    background: bg ?? "transparent",
  };
}

function SlideHeader({
  num,
  title,
  accent,
}: {
  num: string;
  title: string;
  accent: string;
}) {
  return (
    <div style={{ textAlign: "center", marginBottom: "3rem" }}>
      <span
        style={{
          fontSize: "0.75rem",
          letterSpacing: "0.3em",
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {num}
      </span>
      <h2
        style={{
          fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
          fontWeight: 800,
          margin: "0.25rem 0 0",
          color: "#fff",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          width: "60px",
          height: "3px",
          background: accent,
          borderRadius: "999px",
          margin: "1rem auto 0",
        }}
      />
    </div>
  );
}

function MemberCard({
  no,
  name,
  role,
  color,
}: {
  no: string;
  name: string;
  role: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff06",
        border: `1px solid ${color}44`,
        borderRadius: "1rem",
        padding: "1.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: `${color}22`,
          border: `2px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1rem",
          fontSize: "1.2rem",
          fontWeight: 900,
          color,
        }}
      >
        {no}
      </div>
      <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#fff" }}>
        {name}
      </div>
      <div style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.35rem" }}>
        {role}
      </div>
    </div>
  );
}

function ObjectiveRow({
  n,
  text,
  color,
}: {
  n: string;
  text: string;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
        background: "#ffffff05",
        border: `1px solid ${color}33`,
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
      }}
    >
      <span
        style={{
          minWidth: "32px",
          height: "32px",
          borderRadius: "50%",
          background: color,
          color: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 900,
          fontSize: "0.9rem",
          marginTop: "0.1rem",
        }}
      >
        {n}
      </span>
      <p style={{ margin: 0, color: "#ddd", lineHeight: 1.8, fontSize: "0.95rem" }}>
        {text}
      </p>
    </div>
  );
}

function BenefitCard({
  icon,
  title,
  desc,
  color,
}: {
  icon: string;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff06",
        border: `1px solid ${color}44`,
        borderRadius: "1rem",
        padding: "1.5rem",
      }}
    >
      <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>{icon}</div>
      <h3 style={{ color, margin: "0 0 0.5rem", fontSize: "1rem" }}>{title}</h3>
      <p style={{ color: "#aaa", margin: 0, fontSize: "0.88rem", lineHeight: 1.8 }}>
        {desc}
      </p>
    </div>
  );
}

function Highlight({
  children,
  color,
}: {
  children: React.ReactNode;
  color: string;
}) {
  return (
    <span style={{ color, fontWeight: 700 }}>{children}</span>
  );
}
