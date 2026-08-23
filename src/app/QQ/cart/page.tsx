'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { QQCartItem } from '@/types/qq'

const STORES: Record<number, { name: string; icon: string; color1: string; color2: string }> = {
  1: { name: 'ร้านข้าว',        icon: '🍚', color1: '#f97316', color2: '#ea580c' },
  2: { name: 'ร้านน้ำ',         icon: '🧃', color1: '#3b82f6', color2: '#2563eb' },
  3: { name: 'ร้านก๋วยเตี๋ยว', icon: '🍜', color1: '#ef4444', color2: '#dc2626' },
  4: { name: 'ร้านไก่และขนม',  icon: '🍗', color1: '#eab308', color2: '#ca8a04' },
}

type AllCarts = Record<number, QQCartItem[]>

function loadAllCarts(): AllCarts {
  const carts: AllCarts = {}
  for (let i = 1; i <= 4; i++) {
    const cart = JSON.parse(localStorage.getItem(`cart_store_${i}`) || '[]')
    if (cart.length > 0) carts[i] = cart
  }
  return carts
}

function clearAllCarts() {
  for (let i = 1; i <= 4; i++) localStorage.removeItem(`cart_store_${i}`)
}

function CartContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const table = searchParams.get('table') || '1'

  const [allCarts, setAllCarts] = useState<AllCarts>({})
  const [customerName, setCustomerName] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ orderId: string; total: number } | null>(null)

  useEffect(() => { setAllCarts(loadAllCarts()) }, [])

  const grandTotal = Object.values(allCarts).flat().reduce((s, item) => s + item.price * item.quantity, 0)

  function updateQty(storeId: number, idx: number, delta: number) {
    const items = [...(allCarts[storeId] || [])]
    items[idx] = { ...items[idx], quantity: items[idx].quantity + delta }
    const filtered = items.filter((i) => i.quantity > 0)
    const newCarts = { ...allCarts }
    if (filtered.length === 0) {
      delete newCarts[storeId]
      localStorage.removeItem(`cart_store_${storeId}`)
    } else {
      newCarts[storeId] = filtered
      localStorage.setItem(`cart_store_${storeId}`, JSON.stringify(filtered))
    }
    setAllCarts(newCarts)
  }

  function clearStore(storeId: number) {
    if (!confirm(`ต้องการลบรายการจาก${STORES[storeId].name}ทั้งหมด?`)) return
    const newCarts = { ...allCarts }
    delete newCarts[storeId]
    localStorage.removeItem(`cart_store_${storeId}`)
    setAllCarts(newCarts)
  }

  async function confirmOrder() {
    if (Object.keys(allCarts).length === 0) return
    setLoading(true)

    const items = Object.entries(allCarts).flatMap(([storeId, cart]) =>
      cart.map((item) => ({ ...item, storeId: parseInt(storeId) }))
    )

    try {
      const res = await fetch('/api/qq/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_num: table, customer_name: customerName || '-', notes: note || '-', items, total: grandTotal }),
      })
      const data = await res.json()
      if (data.success) {
        clearAllCarts()
        setSuccess({ orderId: data.orderId, total: grandTotal })
        setAllCarts({})
      }
    } catch {
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#fff9e1' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ส่งออเดอร์สำเร็จ!</h2>
          <p className="text-gray-500 mb-4">รายการของคุณถูกส่งเรียบร้อยแล้ว</p>
          <div className="bg-orange-50 rounded-xl p-4 mb-6 text-left">
            <div className="flex justify-between mb-2">
              <span className="text-gray-600">โต๊ะที่:</span>
              <span className="font-bold text-orange-600">{table}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ยอดรวม:</span>
              <span className="font-bold text-xl text-orange-600">{success.total.toLocaleString()} ฿</span>
            </div>
          </div>
          <button
            onClick={() => router.push(`/QQ?table=${table}`)}
            className="w-full py-3 rounded-xl text-white font-bold"
            style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32" style={{ backgroundColor: '#fff9e1' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 text-white px-4 py-4 flex items-center gap-3 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
      >
        <button onClick={() => router.push(`/QQ?table=${table}`)} className="text-white/80 text-2xl">←</button>
        <div>
          <h1 className="text-xl font-bold">🛒 ตะกร้าสินค้า</h1>
          <p className="text-xs text-white/80">โต๊ะที่ {table}</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {Object.keys(allCarts).length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🛒</div>
            <p className="text-gray-500 mb-4">ตะกร้าว่างเปล่า</p>
            <button
              onClick={() => router.push(`/QQ?table=${table}`)}
              className="py-3 px-6 rounded-xl text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
            >
              เลือกร้านอาหาร
            </button>
          </div>
        ) : (
          <>
            {Object.entries(allCarts).map(([sid, items]) => {
              const storeId = parseInt(sid)
              const store = STORES[storeId]
              const storeTotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
              return (
                <div key={storeId} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                  <div
                    className="text-white p-4 flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${store.color1}, ${store.color2})` }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{store.icon}</span>
                      <div>
                        <p className="font-bold text-lg">{store.name}</p>
                        <p className="text-xs text-white/75">{items.length} รายการ</p>
                      </div>
                    </div>
                    <button onClick={() => clearStore(storeId)} className="bg-white/20 p-2 rounded-lg">🗑️</button>
                  </div>
                  <div className="p-4 space-y-3">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                        <span className="text-3xl">{item.image?.startsWith('http') ? '🍽️' : (item.image || '🍽️')}</span>
                        <div className="flex-1">
                          <p className="font-semibold text-sm text-gray-800">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.price} ฿/ชิ้น</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(storeId, idx, -1)} className="bg-gray-200 w-8 h-8 rounded-full">-</button>
                          <span className="w-8 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateQty(storeId, idx, 1)} className="bg-orange-500 text-white w-8 h-8 rounded-full">+</button>
                        </div>
                        <span className="font-bold" style={{ color: store.color1 }}>
                          {(item.price * item.quantity).toLocaleString()} ฿
                        </span>
                      </div>
                    ))}
                    <div className="border-t pt-3 flex justify-between font-bold">
                      <span className="text-gray-700">รวมร้านนี้:</span>
                      <span style={{ color: store.color1 }}>{storeTotal.toLocaleString()} ฿</span>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Customer Info */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <input
                type="text"
                placeholder="ชื่อลูกค้า (ไม่บังคับ)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-hidden"
              />
              <textarea
                placeholder="หมายเหตุ (ไม่บังคับ)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-green-500 focus:outline-hidden resize-none"
              />
            </div>
          </>
        )}
      </div>

      {/* Footer Total */}
      {Object.keys(allCarts).length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-green-200 p-4 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-gray-700">ยอดรวมทั้งหมด</span>
            <span className="text-2xl font-bold text-green-600">{grandTotal.toLocaleString()} ฿</span>
          </div>
          <button
            onClick={confirmOrder}
            disabled={loading}
            className="w-full py-4 rounded-xl text-white font-bold text-lg disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
          >
            {loading ? 'กำลังส่งออเดอร์...' : '✅ ยืนยันการสั่งอาหาร'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function CartPage() {
  return <Suspense><CartContent /></Suspense>
}
