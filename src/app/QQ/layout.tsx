import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'QQ — Quiet Elephant | ระบบสั่งอาหารออนไลน์',
  description:
    'สั่งอาหารออนไลน์ผ่าน QR Code ที่โต๊ะ เลือกเมนูจากหลายร้าน เพิ่มลงตะกร้า ยืนยันออเดอร์ได้ทันที ไม่ต้องรอพนักงาน',
  keywords: [
    'QQ', 'Quiet Elephant', 'ระบบสั่งอาหาร', 'สั่งอาหารออนไลน์',
    'QR Code เมนู', 'food ordering', 'self-order', 'Centered101',
  ],
  openGraph: {
    title: 'QQ — Quiet Elephant | ระบบสั่งอาหารออนไลน์',
    description: 'สั่งอาหารออนไลน์ผ่าน QR Code ที่โต๊ะ เลือกเมนูจากหลายร้าน ยืนยันออเดอร์ได้ทันที',
    type: 'website',
    locale: 'th_TH',
    images: [{ url: '/qq/favicon.ico', width: 512, height: 512, alt: 'QQ Quiet Elephant' }],
  },
  twitter: {
    card: 'summary',
    title: 'QQ — Quiet Elephant | ระบบสั่งอาหารออนไลน์',
    description: 'สั่งอาหารออนไลน์ผ่าน QR Code ที่โต๊ะ ไม่ต้องรอพนักงาน',
    images: ['/qq/favicon.ico'],
  },
  robots: { index: false, follow: false },
}

export default function QQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
