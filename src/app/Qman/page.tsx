'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function QmanLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('TESTBOT@ASIA-BOT.XYZ')
  const [password, setPassword] = useState('BOTจัดดด')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/qman/seed').catch(() => {})
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/qman/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        return
      }
      sessionStorage.setItem('qman_user', JSON.stringify(data.user))
      router.push('/Qman/home')
    } catch {
      setError('ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden relative"
      style={{ background: 'linear-gradient(135deg, #ff7300 0%, #ff6200 50%, #fc9014 100%)' }}
    >
      {/* Decorative circles */}
      <div className="absolute w-72 h-72 rounded-full bg-white/10 -top-36 -right-24 pointer-events-none" />
      <div className="absolute w-48 h-48 rounded-full bg-white/10 bottom-24 -left-12 pointer-events-none" />

      {/* Header */}
      <header className="container mx-auto px-4 py-6" data-aos="fade-down">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
            <img src="/qman/favicon.ico" alt="Qman" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white drop-shadow-sm">Q-MAN</h1>
            <p className="text-xs text-white/90">Queue Management System</p>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-8 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left — feature list */}
          <div className="text-white space-y-6" data-aos="fade-right">
            <h2 className="text-4xl lg:text-5xl font-bold drop-shadow-lg leading-tight">
              จองคิวออนไลน์<br />ไม่ต้องรอนาน
            </h2>
            <div className="space-y-3">
              {[
                { icon: 'fa-clock',        title: 'ประหยัดเวลา',         desc: 'จองคิวล่วงหน้า ไม่ต้องรอนาน' },
                { icon: 'fa-mobile-screen',title: 'ใช้งานง่าย',          desc: 'จองผ่านมือถือได้ทุกที่ทุกเวลา' },
                { icon: 'fa-bell',         title: 'แจ้งเตือนอัตโนมัติ', desc: 'รับการแจ้งเตือนเมื่อถึงคิว' },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-2xl p-4">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <i className={`fa-solid ${f.icon} text-white text-lg`} />
                  </div>
                  <div>
                    <h3 className="font-bold">{f.title}</h3>
                    <p className="text-white/80 text-sm">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-3xl shadow-2xl p-8" data-aos="fade-left">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
                <img src="/qman/favicon.ico" alt="Qman" className="w-12 h-12 object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h2>
              <p className="text-gray-500 text-sm mt-1">เพื่อเริ่มใช้งาน Q-MAN</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-envelope mr-1 text-orange-400" />อีเมล
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-hidden transition"
                  placeholder="TESTBOT@ASIA-BOT.XYZ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-lock mr-1 text-orange-400" />รหัสผ่าน
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-hidden transition"
                  placeholder="••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
                  <i className="fa-solid fa-circle-exclamation mr-2" />{error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl text-white font-bold text-lg disabled:opacity-60 transition hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, #ff7300, #ff6200)' }}
              >
                {loading
                  ? <><i className="asia-spinner mr-2" />กำลังเข้าสู่ระบบ...</>
                  : <><i className="fa-solid fa-right-to-bracket mr-2" />เข้าสู่ระบบ</>
                }
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              <i className="fa-solid fa-circle-info mr-1" />Demo: TESTBOT@ASIA-BOT.XYZ / BOTจัดดด
            </p>
          </div>
        </div>
      </section>

      {/* Why Q-MAN */}
      <section className="container mx-auto px-4 py-12">
        <h2
          className="text-3xl font-bold text-white text-center mb-8 drop-shadow-sm"
          data-aos="fade-up"
        >
          ทำไมต้อง Q-MAN?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: 'fa-calendar-check', title: 'จองคิวออนไลน์',      desc: 'จองคิวได้ตลอด 24 ชั่วโมง' },
            { icon: 'fa-bell',           title: 'แจ้งเตือนอัตโนมัติ', desc: 'รับการแจ้งเตือนผ่าน SMS หรืออีเมล' },
            { icon: 'fa-chart-line',     title: 'ติดตามสถานะ',        desc: 'เช็คสถานะคิวแบบเรียลไทม์' },
            { icon: 'fa-shield-halved',  title: 'ปลอดภัย',            desc: 'ข้อมูลปลอดภัยด้วยระบบเข้ารหัส' },
            { icon: 'fa-users',          title: 'จัดการง่าย',         desc: 'เจ้าของร้านจัดการคิวได้สะดวก' },
            { icon: 'fa-mobile-screen',  title: 'รองรับทุกอุปกรณ์',  desc: 'ใช้งานได้บนมือถือ แท็บเล็ต และคอมพิวเตอร์' },
          ].map((f, i) => (
            <div
              key={f.title}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white"
              data-aos="zoom-in"
              data-aos-delay={i * 60}
            >
              <i className={`fa-solid ${f.icon} text-3xl mb-3 block`} />
              <h3 className="font-bold text-lg mb-1">{f.title}</h3>
              <p className="text-white/80 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
