import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Q-MAN | ระบบจองคิวออนไลน์',
  description:
    'จองคิวออนไลน์ล่วงหน้าสำหรับร้านอาหาร โรงพยาบาล คลินิก ร้านตัดผม ธนาคาร และสปา ไม่ต้องรอนาน จัดการคิวง่ายๆ ผ่านมือถือ',
  keywords: [
    'Q-MAN', 'จองคิว', 'คิวออนไลน์', 'จองคิวล่วงหน้า', 'queue booking',
    'ระบบจองคิว', 'คิวร้านอาหาร', 'คิวโรงพยาบาล', 'Centered101',
  ],
  openGraph: {
    title: 'Q-MAN | ระบบจองคิวออนไลน์',
    description: 'จองคิวออนไลน์ล่วงหน้า ร้านอาหาร โรงพยาบาล สปา และอื่นๆ ไม่ต้องรอนาน',
    type: 'website',
    locale: 'th_TH',
    images: [{ url: '/qman/favicon.ico', width: 512, height: 512, alt: 'Q-MAN Queue Management' }],
  },
  twitter: {
    card: 'summary',
    title: 'Q-MAN | ระบบจองคิวออนไลน์',
    description: 'จองคิวออนไลน์ล่วงหน้า ไม่ต้องรอนาน จัดการง่ายผ่านมือถือ',
    images: ['/qman/favicon.ico'],
  },
  robots: { index: false, follow: false },
}

export default function QmanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
