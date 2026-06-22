'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { QQMenuItem, QQCartItem } from '@/types/qq'

const STORES: Record<number, { name: string; icon: string; color1: string; color2: string }> = {
  1: { name: 'ร้านข้าว',        icon: 'fa-bowl-rice',      color1: '#f97316', color2: '#ea580c' },
  2: { name: 'ร้านน้ำ',         icon: 'fa-bottle-water',   color1: '#3b82f6', color2: '#2563eb' },
  3: { name: 'ร้านก๋วยเตี๋ยว', icon: 'fa-utensils',       color1: '#ef4444', color2: '#dc2626' },
  4: { name: 'ร้านไก่และขนม',  icon: 'fa-drumstick-bite', color1: '#eab308', color2: '#ca8a04' },
}

function MenuContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const storeId = parseInt(searchParams.get('store') || '1')
  const table = searchParams.get('table') || '1'
  const store = STORES[storeId] || STORES[1]

  const [menu, setMenu] = useState<QQMenuItem[]>([])
  const [cart, setCart] = useState<QQCartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cartOpen, setCartOpen] = useState(false)

  useEffect(() => {
    fetchMenu()
    loadCart()
  }, [storeId])

  async function fetchMenu() {
    setLoading(true)
    try {
      const res = await fetch(`/api/qq/menu?storeId=${storeId}`)
      const data = await res.json()
      setMenu(Array.isArray(data) ? data : [])
    } catch {
      setMenu([])
    } finally {
      setLoading(false)
    }
  }

  function loadCart() {
    const saved = localStorage.getItem(`cart_store_${storeId}`)
    setCart(saved ? JSON.parse(saved) : [])
  }

  function saveCart(newCart: QQCartItem[]) {
    localStorage.setItem(`cart_store_${storeId}`, JSON.stringify(newCart))
    setCart(newCart)
  }

  function addToCart(item: QQMenuItem) {
    const existing = cart.find((c) => c.id === item.id)
    let newCart: QQCartItem[]
    if (existing) {
      newCart = cart.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
    } else {
      newCart = [...cart, { id: item.id, name: item.name, price: item.price, category: item.category, image: item.image, quantity: 1, storeId }]
    }
    saveCart(newCart)
  }

  function changeQty(id: number, delta: number) {
    let newCart = cart.map((c) => c.id === id ? { ...c, quantity: c.quantity + delta } : c)
    newCart = newCart.filter((c) => c.quantity > 0)
    saveCart(newCart)
  }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0)
  const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0)

  const isUrl = (s: string) => s?.startsWith('http') || s?.startsWith('/')

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff9e1' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 text-white px-4 py-4 flex items-center justify-between shadow-lg"
        style={{ background: `linear-gradient(135deg, ${store.color1}, ${store.color2})` }}
      >
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/QQ?table=${table}`)} className="text-white/80 text-2xl">
            <i className="fa-solid fa-arrow-left" />
          </button>
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow overflow-hidden">
            <img src="/qq/favicon.ico" alt="QQ" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              <i className={`fa-solid ${store.icon} mr-2`} />{store.name}
            </h1>
            <p className="text-xs text-white/80">
              <i className="fa-solid fa-chair mr-1" />โต๊ะที่ {table}
            </p>
          </div>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative bg-white/20 text-white font-bold px-4 py-2 rounded-xl"
        >
          <i className="fa-solid fa-cart-shopping" />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Menu Grid */}
      <div className="p-4 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">กำลังโหลดเมนู...</div>
        ) : menu.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <i className="fa-solid fa-plate-wheat text-6xl mb-3 block text-gray-300" />
            <p>ยังไม่มีเมนูในร้านนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {menu.map((item, i) => (
              <div
                key={item.id}
                data-aos="zoom-in"
                data-aos-delay={i * 60}
                className={`bg-orange-50 border border-orange-100 rounded-2xl shadow overflow-hidden ${!item.is_available ? 'opacity-50' : ''}`}
              >
                <div className="bg-white/60 flex items-center justify-center h-40">
                  {isUrl(item.image) ? (
                    <img src={item.image} alt={item.name} className="w-full h-40 object-cover" />
                  ) : (
                    <i className="fa-solid fa-plate-wheat text-6xl text-gray-300" />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800">{item.name}</h3>
                  <p className="text-xs text-gray-500 mb-2">{item.category}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-orange-500">{item.price} ฿</span>
                    {item.is_available ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="text-white text-sm px-3 py-1.5 rounded-lg"
                        style={{ background: `linear-gradient(135deg, ${store.color1}, ${store.color2})` }}
                      >
                        + เพิ่ม
                      </button>
                    ) : (
                      <span className="text-red-500 text-sm font-semibold">หมด</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Checkout button */}
        {cartCount > 0 && (
          <button
            onClick={() => router.push(`/QQ/cart?table=${table}`)}
            className="mt-6 w-full py-4 rounded-2xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
          >
            <i className="fa-solid fa-cart-shopping" />ไปหน้าตะกร้า ({cartCount} ชิ้น · {cartTotal.toLocaleString()} ฿)
          </button>
        )}
      </div>

      {/* Cart Sidebar Modal */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setCartOpen(false)}>
          <div className="bg-white w-full max-w-sm h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">ตะกร้า {store.name}</h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 text-2xl">✕</button>
            </div>

            {cart.length === 0 ? (
              <p className="text-center text-gray-500 py-8">ยังไม่มีรายการ</p>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-orange-50 rounded-xl p-3">
                      <span className="text-3xl">{isUrl(item.image) ? '🍽️' : (item.image || '🍽️')}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-orange-500 text-sm">{item.price} ฿</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => changeQty(item.id, -1)} className="bg-gray-200 w-7 h-7 rounded-full text-sm">-</button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button onClick={() => changeQty(item.id, 1)} className="bg-orange-500 text-white w-7 h-7 rounded-full text-sm">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 mb-4">
                  <div className="flex justify-between font-bold text-lg">
                    <span>รวม</span>
                    <span className="text-orange-500">{cartTotal.toLocaleString()} ฿</span>
                  </div>
                </div>
                <button
                  onClick={() => { setCartOpen(false); router.push(`/QQ/cart?table=${table}`) }}
                  className="w-full py-3 rounded-xl text-white font-bold"
                  style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
                >
                  ยืนยันและดูตะกร้ารวม
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MenuPage() {
  return <Suspense><MenuContent /></Suspense>
}
