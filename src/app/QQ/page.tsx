'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const STORES = [
  { id: 1, name: 'ร้านข้าว',        icon: 'fa-bowl-rice',     color1: '#f97316', color2: '#ea580c' },
  { id: 2, name: 'ร้านน้ำ',         icon: 'fa-bottle-water',  color1: '#3b82f6', color2: '#2563eb' },
  { id: 3, name: 'ร้านก๋วยเตี๋ยว', icon: 'fa-utensils',      color1: '#ef4444', color2: '#dc2626' },
  { id: 4, name: 'ร้านไก่และขนม',  icon: 'fa-drumstick-bite',color1: '#eab308', color2: '#ca8a04' },
]

function getTotalCartCount() {
  if (typeof window === 'undefined') return 0
  return [1, 2, 3, 4].reduce((sum, i) => {
    const cart = JSON.parse(localStorage.getItem(`cart_store_${i}`) || '[]')
    return sum + cart.reduce((s: number, item: { quantity: number }) => s + item.quantity, 0)
  }, 0)
}

function IndexContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const table = searchParams.get('table') || 'ไม่ระบุโต๊ะ'
  const [cartCount, setCartCount] = useState(0)

  useEffect(() => {
    setCartCount(getTotalCartCount())
  }, [])

  const goToStore = (storeId: number) =>
    router.push(`/QQ/menu?store=${storeId}&table=${table}`)

  const viewCart = () => router.push(`/QQ/cart?table=${table}`)

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff9e1' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 text-white px-4 py-4 flex items-center justify-between shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/qq/favicon.ico" alt="QQ" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Quiet Elephant</h1>
            <p className="text-xs text-white/80">
              <i className="fa-solid fa-chair mr-1" />โต๊ะที่ <span className="font-bold">{table}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/QQ/admin" className="bg-white/20 text-white text-xs px-3 py-2 rounded-lg">
            <i className="fa-solid fa-gear mr-1" />Admin
          </a>
          <button
            onClick={viewCart}
            className="relative bg-white text-green-600 font-bold px-4 py-2 rounded-xl shadow-sm flex items-center gap-2"
          >
            <i className="fa-solid fa-cart-shopping" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stores Grid */}
      <div className="p-4 max-w-2xl mx-auto">
        <h2
          className="text-xl font-bold text-gray-700 mb-4 mt-2"
          data-aos="fade-down"
        >
          <i className="fa-solid fa-store text-green-500 mr-2" />เลือกร้านอาหาร
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {STORES.map((store, i) => (
            <button
              key={store.id}
              onClick={() => goToStore(store.id)}
              data-aos="zoom-in"
              data-aos-delay={i * 80}
              className="rounded-2xl shadow-lg p-6 text-white text-center transform hover:scale-105 transition active:scale-95"
              style={{ background: `linear-gradient(135deg, ${store.color1}, ${store.color2})` }}
            >
              <i className={`fa-solid ${store.icon} text-5xl mb-3 block`} />
              <div className="font-bold text-lg">{store.name}</div>
              <div className="text-white/80 text-sm mt-1">
                <i className="fa-solid fa-arrow-right mr-1" />แตะเพื่อดูเมนู
              </div>
            </button>
          ))}
        </div>

        {/* View Cart */}
        <button
          onClick={viewCart}
          data-aos="fade-up"
          data-aos-delay="300"
          className="mt-6 w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-3"
          style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
        >
          <i className="fa-solid fa-cart-shopping" />
          <span>ดูตะกร้าสินค้า</span>
          {cartCount > 0 && (
            <span className="bg-white text-green-600 rounded-full px-2 py-0.5 text-sm font-bold">
              {cartCount} ชิ้น
            </span>
          )}
        </button>
      </div>
    </div>
  )
}

export default function QQIndexPage() {
  return (
    <Suspense>
      <IndexContent />
    </Suspense>
  )
}
