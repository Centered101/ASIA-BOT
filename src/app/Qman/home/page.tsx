'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { QmanCategory, QmanShop, QmanBooking, QmanUser } from '@/types/qman'

const FALLBACK_CATEGORIES: QmanCategory[] = [
  { id: 1, name: 'ร้านอาหาร',  icon: 'fa-utensils',        color_from: '#f87171', color_to: '#dc2626' },
  { id: 2, name: 'โรงพยาบาล', icon: 'fa-hospital',         color_from: '#60a5fa', color_to: '#2563eb' },
  { id: 3, name: 'ร้านตัดผม', icon: 'fa-scissors',         color_from: '#c084fc', color_to: '#9333ea' },
  { id: 4, name: 'ธนาคาร',    icon: 'fa-building-columns', color_from: '#4ade80', color_to: '#16a34a' },
  { id: 5, name: 'คลินิก',    icon: 'fa-stethoscope',      color_from: '#f472b6', color_to: '#db2777' },
  { id: 6, name: 'สปา',       icon: 'fa-spa',              color_from: '#2dd4bf', color_to: '#0d9488' },
]

type View = 'categories' | 'shops'

interface BookingForm {
  customerName: string
  customerPhone: string
  bookingDate: string
  bookingTime: string
  notes: string
}

export default function QmanHomePage() {
  const router = useRouter()
  const [user, setUser] = useState<QmanUser | null>(null)
  const [view, setView] = useState<View>('categories')
  const [categories] = useState<QmanCategory[]>(FALLBACK_CATEGORIES)
  const [shops, setShops] = useState<QmanShop[]>([])
  const [selectedCategory, setSelectedCategory] = useState<QmanCategory | null>(null)
  const [selectedShop, setSelectedShop] = useState<QmanShop | null>(null)
  const [bookings, setBookings] = useState<QmanBooking[]>([])
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState<{ queue: string; shop: string; date: string; time: string; price: number } | null>(null)
  const [showProfile, setShowProfile] = useState(false)
  const [showDetail, setShowDetail] = useState<QmanBooking | null>(null)
  const [form, setForm] = useState<BookingForm>({
    customerName: '', customerPhone: '', bookingDate: '', bookingTime: '', notes: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem('qman_user')
    if (!stored) { router.push('/Qman'); return }
    const u = JSON.parse(stored) as QmanUser
    setUser(u)
    fetchBookings(u.id)
    const today = new Date().toISOString().split('T')[0]
    setForm((f) => ({ ...f, bookingDate: today }))
  }, [])

  async function fetchShops(categoryId: number) {
    const res = await fetch(`/api/qman/shops?categoryId=${categoryId}`)
    const data = await res.json()
    setShops(Array.isArray(data) ? data : [])
  }

  async function fetchBookings(userId: string) {
    const res = await fetch(`/api/qman/bookings?userId=${userId}`)
    const data = await res.json()
    setBookings(Array.isArray(data) ? data : [])
  }

  function selectCategory(cat: QmanCategory) {
    setSelectedCategory(cat)
    fetchShops(cat.id)
    setView('shops')
  }

  function openBooking(shop: QmanShop) {
    setSelectedShop(shop)
    setForm((f) => ({ ...f, customerName: '', customerPhone: '', notes: '' }))
    setError('')
    setShowBookingModal(true)
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedShop || !user) return
    if (user.wallet_balance < selectedShop.price_per_booking) {
      setError('ยอดเงินในกระเป๋าไม่เพียงพอ')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/qman/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          shopId: selectedShop.id,
          shopName: selectedShop.name,
          shopBranch: selectedShop.branch,
          shopLogo: selectedShop.logo_url,
          shopMap: selectedShop.map_url,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          bookingDate: form.bookingDate,
          bookingTime: form.bookingTime,
          notes: form.notes,
          price: selectedShop.price_per_booking,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'เกิดข้อผิดพลาด'); return }

      const newBalance = data.newWalletBalance ?? user.wallet_balance - selectedShop.price_per_booking
      const updatedUser = { ...user, wallet_balance: newBalance }
      setUser(updatedUser)
      sessionStorage.setItem('qman_user', JSON.stringify(updatedUser))

      setShowBookingModal(false)
      setShowSuccessModal({
        queue: data.queueNumber,
        shop: `${selectedShop.name} - ${selectedShop.branch}`,
        date: form.bookingDate,
        time: form.bookingTime,
        price: selectedShop.price_per_booking,
      })
      fetchBookings(user.id)
    } finally {
      setSubmitting(false)
    }
  }

  function logout() {
    sessionStorage.removeItem('qman_user')
    router.push('/Qman')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-orange-50">

      {/* Header */}
      <header
        className="sticky top-0 z-40 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #ff7300, #ff6200)' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow overflow-hidden">
              <img src="/qman/favicon.ico" alt="Qman" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Q-MAN</h1>
              <p className="text-xs text-white/80">
                <i className="fa-solid fa-ticket mr-1" />เลือกร้านค้าที่ต้องการจองคิว
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-white/20 px-3 py-2 rounded-lg">
              <i className="fa-solid fa-wallet text-white" />
              <span className="text-white font-bold text-sm">฿{user.wallet_balance.toLocaleString()}</span>
            </div>
            <button
              onClick={() => setShowProfile(true)}
              className="bg-white/20 text-white p-2 rounded-lg"
            >
              <i className="fa-solid fa-user" />
            </button>
          </div>
        </div>
      </header>

      {/* Back button */}
      {view === 'shops' && (
        <button
          onClick={() => { setView('categories'); setShops([]) }}
          className="flex items-center gap-2 text-gray-700 p-4 font-medium"
          data-aos="fade-right"
        >
          <i className="fa-solid fa-arrow-left" /> ย้อนกลับ
        </button>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pb-8">

        {/* Categories */}
        {view === 'categories' && (
          <div>
            <h2
              className="text-xl font-bold text-gray-700 mb-4 pt-4"
              data-aos="fade-down"
            >
              <i className="fa-solid fa-th-large text-orange-400 mr-2" />เลือกหมวดหมู่บริการ
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat, i) => (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat)}
                  data-aos="zoom-in"
                  data-aos-delay={i * 70}
                  className="rounded-2xl p-6 text-white text-center shadow-lg transform hover:scale-105 transition active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${cat.color_from}, ${cat.color_to})` }}
                >
                  <i className={`fa-solid ${cat.icon} text-5xl mb-3 block`} />
                  <p className="font-bold text-lg">{cat.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shops */}
        {view === 'shops' && (
          <div>
            <h2
              className="text-xl font-bold text-gray-700 mb-4"
              data-aos="fade-down"
            >
              {selectedCategory && (
                <i
                  className={`fa-solid ${selectedCategory.icon} mr-2`}
                  style={{ color: selectedCategory.color_from }}
                />
              )}
              {selectedCategory?.name}
            </h2>
            {shops.length === 0 ? (
              <p className="text-center text-gray-400 py-8">
                <i className="fa-solid fa-store-slash block text-5xl mb-2 opacity-30" />
                ไม่พบร้านค้า
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shops.map((shop, i) => (
                  <div
                    key={shop.id}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden"
                    data-aos="fade-up"
                    data-aos-delay={i * 60}
                  >
                    <div className="p-4">
                      <div className="flex gap-3 mb-3">
                        {shop.logo_url ? (
                          <img
                            src={shop.logo_url}
                            alt={shop.name}
                            className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                          />
                        ) : (
                          <div className="w-16 h-16 bg-orange-50 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-store text-3xl text-orange-300" />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-gray-800">{shop.name}</h3>
                              <p className="text-xs text-gray-500">
                                <i className="fa-solid fa-location-dot mr-1" />{shop.branch}
                              </p>
                            </div>
                            {shop.badge === 'hot' && (
                              <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                                <i className="fa-solid fa-fire mr-1" />ยอดนิยม
                              </span>
                            )}
                            {shop.badge === 'popular' && (
                              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                                <i className="fa-solid fa-star mr-1" />แนะนำ
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t">
                        <span className="text-2xl font-bold text-orange-500">
                          {shop.price_per_booking > 0 ? `฿${shop.price_per_booking}` : 'ฟรี'}
                        </span>
                        <button
                          onClick={() => openBooking(shop)}
                          className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-xl font-semibold text-sm transition"
                        >
                          <i className="fa-solid fa-calendar-plus mr-2" />จองคิว
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Booking Modal */}
      {showBookingModal && selectedShop && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedShop.logo_url && (
                  <img src={selectedShop.logo_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                )}
                <div>
                  <h3 className="font-bold text-gray-800">{selectedShop.name}</h3>
                  <p className="text-xs text-gray-500">
                    <i className="fa-solid fa-location-dot mr-1" />{selectedShop.branch}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowBookingModal(false)} className="text-gray-400 text-2xl leading-none">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={submitBooking} className="p-4 space-y-4">
              {selectedShop.map_url && (
                <div className="w-full bg-orange-100 rounded-xl overflow-hidden">
                  <img src={selectedShop.map_url} alt="แผนที่" className="w-full h-48 object-cover" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-user mr-1 text-orange-400" />ชื่อ-นามสกุล *
                </label>
                <input
                  type="text" required value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  placeholder="กรอกชื่อของคุณ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-phone mr-1 text-orange-400" />เบอร์โทรศัพท์ *
                </label>
                <input
                  type="tel" required maxLength={10} value={form.customerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value.replace(/\D/g, '') }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  placeholder="0812345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-calendar-days mr-1 text-orange-400" />วันที่ *
                </label>
                <input
                  type="date" required value={form.bookingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setForm((f) => ({ ...f, bookingDate: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-clock mr-1 text-orange-400" />เวลา *
                </label>
                <input
                  type="time" required value={form.bookingTime}
                  onChange={(e) => setForm((f) => ({ ...f, bookingTime: e.target.value }))}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <i className="fa-solid fa-comment mr-1 text-orange-400" />หมายเหตุ
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none"
                  placeholder="ระบุข้อมูลเพิ่มเติม..."
                />
              </div>

              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 flex justify-between items-center">
                <span className="text-gray-600">
                  <i className="fa-solid fa-tag mr-1 text-orange-400" />ค่าบริการ
                </span>
                <span className="text-2xl font-bold text-orange-500">
                  {selectedShop.price_per_booking > 0 ? `฿${selectedShop.price_per_booking}` : 'ฟรี'}
                </span>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
                  <i className="fa-solid fa-circle-exclamation mr-2" />{error}
                </div>
              )}

              <button
                type="submit" disabled={submitting}
                className="w-full py-4 rounded-xl text-white font-bold text-lg disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #ff7300, #ff6200)' }}
              >
                {submitting
                  ? <><i className="asia-spinner mr-2" />กำลังจอง...</>
                  : <><i className="fa-solid fa-circle-check mr-2" />ยืนยันการจอง</>
                }
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-circle-check text-green-500 text-5xl" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-4">จองคิวสำเร็จ!</h3>
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="text-3xl font-bold text-orange-500 text-center mb-3 tracking-widest">
                {showSuccessModal.queue}
              </div>
              {[
                { label: 'ร้าน:', value: showSuccessModal.shop },
                { label: 'วันที่:', value: showSuccessModal.date },
                { label: 'เวลา:', value: showSuccessModal.time },
                { label: 'ค่าบริการ:', value: `฿${showSuccessModal.price}` },
              ].map((row) => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className="font-medium text-right max-w-[60%]">{row.value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowSuccessModal(null)}
              className="w-full py-3 rounded-xl text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #ff7300, #ff6200)' }}
            >
              <i className="fa-solid fa-check mr-2" />เสร็จสิ้น
            </button>
          </div>
        </div>
      )}

      {/* Profile Slide Panel */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowProfile(false)}>
          <div className="bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-white" style={{ background: 'linear-gradient(135deg, #ff7300, #ff6200)' }}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">
                  <i className="fa-solid fa-user-circle mr-2" />โปรไฟล์
                </h3>
                <button onClick={() => setShowProfile(false)} className="text-white/80 text-2xl">
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
              <div className="bg-white/20 rounded-xl p-4">
                <p className="text-white/80 text-sm">
                  <i className="fa-solid fa-wallet mr-1" />ยอดเงินคงเหลือ
                </p>
                <p className="text-3xl font-bold">฿{user.wallet_balance.toLocaleString()}</p>
              </div>
            </div>

            <div className="p-4 border-b">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-orange-50 rounded-xl p-4 text-center">
                  <i className="fa-solid fa-ticket text-orange-400 text-xl mb-1 block" />
                  <p className="text-gray-500 text-xs mb-1">การจองทั้งหมด</p>
                  <p className="text-2xl font-bold text-orange-500">{bookings.length}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <i className="fa-solid fa-star text-blue-400 text-xl mb-1 block" />
                  <p className="text-gray-500 text-xs mb-1">คะแนนสะสม</p>
                  <p className="text-2xl font-bold text-blue-500">{bookings.length * 10}</p>
                </div>
              </div>
            </div>

            <div className="p-4">
              <h4 className="font-bold text-lg mb-3">
                <i className="fa-solid fa-clock-rotate-left mr-2 text-orange-400" />ประวัติการจอง
              </h4>
              {bookings.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <i className="fa-solid fa-clipboard-list text-4xl mb-2 block opacity-30" />
                  <p>ยังไม่มีประวัติการจอง</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {bookings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setShowDetail(b)}
                      className="w-full bg-white border-2 border-gray-100 rounded-xl p-3 text-left hover:border-orange-300 transition"
                    >
                      <div className="flex items-center gap-3">
                        {b.shop_logo ? (
                          <img src={b.shop_logo} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        ) : (
                          <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center">
                            <i className="fa-solid fa-store text-orange-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{b.shop_name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            <i className="fa-solid fa-location-dot mr-1" />{b.shop_branch}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-green-600 text-sm">฿{b.price}</p>
                          <p className="text-xs text-orange-400 font-mono">{b.queue_number}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={logout}
                className="w-full py-3 rounded-xl bg-red-50 text-red-600 font-semibold"
              >
                <i className="fa-solid fa-right-from-bracket mr-2" />ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Detail Modal */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="p-4 text-white flex justify-between items-center" style={{ background: 'linear-gradient(135deg, #ff7300, #ff6200)' }}>
              <h3 className="font-bold text-lg">
                <i className="fa-solid fa-receipt mr-2" />รายละเอียดการจอง
              </h3>
              <button onClick={() => setShowDetail(null)} className="text-white/80 text-xl">
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {showDetail.shop_logo && (
                <img src={showDetail.shop_logo} alt="" className="w-20 h-20 rounded-xl object-cover mx-auto border-2 border-white shadow" />
              )}
              {showDetail.shop_map && (
                <div className="bg-orange-100 rounded-xl overflow-hidden">
                  <img src={showDetail.shop_map} alt="แผนที่" className="w-full h-48 object-cover" />
                </div>
              )}
              <div className="space-y-2 text-sm">
                {[
                  { label: 'หมายเลขคิว', value: showDetail.queue_number, bold: true, orange: true },
                  { label: 'สถานะ', value: showDetail.status },
                  { label: 'ร้าน', value: showDetail.shop_name },
                  { label: 'สาขา', value: showDetail.shop_branch },
                  { label: 'ผู้จอง', value: showDetail.customer_name },
                  { label: 'เบอร์โทร', value: showDetail.customer_phone },
                  { label: 'วันที่', value: showDetail.booking_date },
                  { label: 'เวลา', value: showDetail.booking_time },
                  { label: 'ค่าบริการ', value: `฿${showDetail.price}`, bold: true, green: true },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between py-1 border-b border-gray-100">
                    <span className="text-gray-500">{row.label}</span>
                    <span className={`${row.bold ? 'font-bold' : 'font-medium'} ${row.orange ? 'text-orange-500' : row.green ? 'text-green-600' : 'text-gray-800'}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
                {showDetail.notes && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-2 text-gray-700">
                    <i className="fa-solid fa-comment mr-2 text-blue-400" />{showDetail.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
