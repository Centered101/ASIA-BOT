import { SITE_NAME } from "@/lib/site-config"

export type ActivityCategory = "camp" | "workshop" | "competition" | "openhouse"

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  camp: "ค่าย",
  workshop: "เวิร์กชอป",
  competition: "การแข่งขัน",
  openhouse: "Open House",
}

export const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  camp: "bg-chart-3/15 text-chart-3",
  workshop: "bg-chart-2/15 text-chart-2",
  competition: "bg-chart-5/15 text-chart-5",
  openhouse: "bg-chart-4/15 text-chart-4",
}

export interface Activity {
  id: string
  title: string
  org: string
  category: ActivityCategory
  location: string
  date: string
  image: string
  price: string
  seats: number
  tags: string[]
}

export const activities: Activity[] = [
  {
    id: "1",
    title: "ค่ายวิศวกรรมหุ่นยนต์ Robotics Bootcamp",
    org: "คณะวิศวกรรมศาสตร์ จุฬาฯ",
    category: "camp",
    location: "กรุงเทพมหานคร",
    date: "12-14 ก.ค. 2569",
    image: "/robotics-camp-students-building-robots.png",
    price: "ฟรี",
    seats: 40,
    tags: ["หุ่นยนต์", "STEM", "วิศวกรรม"],
  },
  {
    id: "2",
    title: "เวิร์กชอปออกแบบ UX/UI สำหรับมือใหม่",
    org: "Digital Academy",
    category: "workshop",
    location: "ออนไลน์",
    date: "20 ก.ค. 2569",
    image: "/ux-ui-design-workshop-laptop-wireframes.png",
    price: "290 บาท",
    seats: 100,
    tags: ["ดีไซน์", "เทคโนโลยี"],
  },
  {
    id: "3",
    title: "การแข่งขันตอบปัญหาวิทยาศาสตร์ระดับประเทศ",
    org: "สสวท.",
    category: "competition",
    location: "เชียงใหม่",
    date: "5 ส.ค. 2569",
    image: "/science-competition-students-stage.png",
    price: "ฟรี",
    seats: 200,
    tags: ["วิทยาศาสตร์", "แข่งขัน"],
  },
  {
    id: "4",
    title: "Open House คณะแพทยศาสตร์ ม.มหิดล",
    org: "มหาวิทยาลัยมหิดล",
    category: "openhouse",
    location: "นครปฐม",
    date: "18 ส.ค. 2569",
    image: "/medical-school-open-house-campus-tour.png",
    price: "ฟรี",
    seats: 300,
    tags: ["แพทย์", "แนะแนว"],
  },
  {
    id: "5",
    title: "ค่ายศิลปะสร้างสรรค์ Young Artist Camp",
    org: "หอศิลป์ร่วมสมัย",
    category: "camp",
    location: "กรุงเทพมหานคร",
    date: "1-3 ก.ย. 2569",
    image: "/art-camp-students-painting-creative.png",
    price: "500 บาท",
    seats: 30,
    tags: ["ศิลปะ", "สร้างสรรค์"],
  },
  {
    id: "6",
    title: "แฮกกาธอนพัฒนาแอปเพื่อสังคม Social Hack",
    org: "Tech for Good TH",
    category: "competition",
    location: "ออนไลน์",
    date: "10-11 ก.ย. 2569",
    image: "/hackathon-students-coding-teamwork.png",
    price: "ฟรี",
    seats: 150,
    tags: ["โค้ดดิ้ง", "นวัตกรรม"],
  },
]

export interface Portfolio {
  id: string
  name: string
  school: string
  avatar: string
  cover: string
  field: string
  achievements: number
  likes: number
}

export const portfolios: Portfolio[] = [
  {
    id: "1",
    name: "ณิชา วัฒนกุล",
    school: "รร.เตรียมอุดมศึกษา",
    avatar: "/thai-female-student-portrait.png",
    cover: "/creative-design-portfolio-cover.png",
    field: "ดีไซน์ & สื่อสาร",
    achievements: 12,
    likes: 248,
  },
  {
    id: "2",
    name: "ธนกร ศรีสุวรรณ",
    school: "รร.สวนกุหลาบวิทยาลัย",
    avatar: "/thai-male-student-portrait.png",
    cover: "/robotics-engineering-portfolio-cover.png",
    field: "วิศวกรรม & หุ่นยนต์",
    achievements: 18,
    likes: 412,
  },
  {
    id: "3",
    name: "พิมพ์ชนก อินทร์แก้ว",
    school: "รร.สตรีวิทยา",
    avatar: "/thai-female-student-portrait-glasses.png",
    cover: "/science-research-portfolio-cover.png",
    field: "วิทยาศาสตร์ชีวภาพ",
    achievements: 15,
    likes: 356,
  },
  {
    id: "4",
    name: "ภูริภัทร มั่งมี",
    school: "รร.มงฟอร์ตวิทยาลัย",
    avatar: "/thai-male-student-portrait-smiling.png",
    cover: "/music-arts-portfolio-cover.png",
    field: "ดนตรี & ศิลปะการแสดง",
    achievements: 9,
    likes: 190,
  },
]

export interface NewsItem {
  id: string
  title: string
  excerpt: string
  image: string
  date: string
  tag: string
}

export const news: NewsItem[] = [
  {
    id: "1",
    title: "เปิดรับสมัคร TCAS69 รอบ Portfolio เริ่มแล้ววันนี้",
    excerpt: "อัปเดตปฏิทินการรับสมัคร พร้อมเคล็ดลับจัดพอร์ตให้โดดเด่นเหนือคู่แข่ง",
    image: "/students-university-admission-news.png",
    date: "1 ก.ค. 2569",
    tag: "แนะแนว",
  },
  {
    id: "2",
    title: "5 ทักษะแห่งอนาคตที่มหาวิทยาลัยชั้นนำมองหา",
    excerpt: `ทำความรู้จักทักษะที่สำคัญและวิธีสะสมประสบการณ์ผ่านกิจกรรมบน ${SITE_NAME}`,
    image: "/future-skills-students-learning.png",
    date: "28 มิ.ย. 2569",
    tag: "พัฒนาตนเอง",
  },
  {
    id: "3",
    title: "รวมค่ายฤดูร้อนสุดฮอตประจำปี 2569",
    excerpt: "คัดสรรค่ายคุณภาพจากทั่วประเทศ ครอบคลุมทุกสายการเรียน",
    image: "/summer-camp-students-outdoor-activities.png",
    date: "20 มิ.ย. 2569",
    tag: "กิจกรรม",
  },
]

export const stats = [
  { label: "กิจกรรมทั้งหมด", value: "2,400+" },
  { label: "นักเรียนที่ใช้งาน", value: "48,000+" },
  { label: "สถาบันพันธมิตร", value: "320+" },
  { label: "เกียรติบัตรที่ออก", value: "156,000+" },
]

export const currentStudent = {
  name: "ณิชา วัฒนกุล",
  email: "nicha.w@student.mycert.th",
  school: "โรงเรียนเตรียมอุดมศึกษา",
  grade: "มัธยมศึกษาปีที่ 6",
  studentId: "6412345",
  avatar: "/thai-female-student-portrait.png",
  bio: "นักเรียนสายศิลป์-คำนวณ สนใจด้านการออกแบบและสื่อสารดิจิทัล มุ่งเข้าคณะนิเทศศาสตร์",
  field: "ดีไซน์ & สื่อสาร",
  profileCompletion: 78,
}

export interface Certificate {
  id: string
  title: string
  issuer: string
  date: string
  status: "verified" | "pending"
  category: ActivityCategory
}

export const certificates: Certificate[] = [
  {
    id: "1",
    title: "ผู้เข้าร่วมเวิร์กชอปออกแบบ UX/UI",
    issuer: "Digital Academy",
    date: "20 ก.ค. 2568",
    status: "verified",
    category: "workshop",
  },
  {
    id: "2",
    title: "รองชนะเลิศการประกวดออกแบบโปสเตอร์",
    issuer: "หอศิลป์ร่วมสมัย",
    date: "5 มิ.ย. 2568",
    status: "verified",
    category: "competition",
  },
  {
    id: "3",
    title: "ผู้เข้าร่วมค่ายศิลปะสร้างสรรค์",
    issuer: "หอศิลป์ร่วมสมัย",
    date: "2 พ.ค. 2568",
    status: "verified",
    category: "camp",
  },
  {
    id: "4",
    title: "เกียรติบัตรอาสาสมัครค่ายพัฒนาชุมชน",
    issuer: "มูลนิธิเพื่อการศึกษา",
    date: "18 เม.ย. 2568",
    status: "pending",
    category: "camp",
  },
]

export interface PortfolioWork {
  id: string
  title: string
  type: string
  date: string
  image: string
  description: string
}

export const portfolioWorks: PortfolioWork[] = [
  {
    id: "1",
    title: "แคมเปญโฆษณารณรงค์ลดขยะพลาสติก",
    type: "งานออกแบบกราฟิก",
    date: "ก.ค. 2568",
    image: "/creative-design-portfolio-cover.png",
    description: "ชุดสื่อโฆษณา 5 ชิ้นสำหรับแคมเปญสิ่งแวดล้อม ได้รับรางวัลรองชนะเลิศ",
  },
  {
    id: "2",
    title: "ต้นแบบแอปพลิเคชันจองห้องสมุด",
    type: "งานออกแบบ UX/UI",
    date: "มิ.ย. 2568",
    image: "/ux-ui-design-workshop-laptop-wireframes.png",
    description: "ออกแบบ prototype แอปจองห้องสมุดโรงเรียน จากเวิร์กชอป Digital Academy",
  },
  {
    id: "3",
    title: "ภาพวาดสีอะคริลิกชุด เมืองในฝัน",
    type: "งานศิลปะ",
    date: "พ.ค. 2568",
    image: "/art-camp-students-painting-creative.png",
    description: "ผลงานจากค่ายศิลปะสร้างสรรค์ Young Artist Camp",
  },
]

export interface MyActivity {
  id: string
  title: string
  org: string
  date: string
  status: "upcoming" | "completed" | "review"
}

export const myActivities: MyActivity[] = [
  { id: "1", title: "ค่ายวิศวกรรมหุ่นยนต์ Robotics Bootcamp", org: "จุฬาฯ", date: "12 ก.ค. 2569", status: "upcoming" },
  { id: "2", title: "Open House คณะนิเทศศาสตร์", org: "ม.ธรรมศาสตร์", date: "18 ส.ค. 2569", status: "upcoming" },
  { id: "3", title: "เวิร์กชอปออกแบบ UX/UI", org: "Digital Academy", date: "20 ก.ค. 2568", status: "completed" },
  { id: "4", title: "การประกวดออกแบบโปสเตอร์", org: "หอศิลป์ร่วมสมัย", date: "5 มิ.ย. 2568", status: "completed" },
  { id: "5", title: "ค่ายพัฒนาชุมชน", org: "มูลนิธิเพื่อการศึกษา", date: "18 เม.ย. 2568", status: "review" },
]
