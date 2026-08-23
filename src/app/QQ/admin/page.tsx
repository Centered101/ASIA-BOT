'use client'

import React, { useEffect, useState } from 'react'

const STORES: Record<number, { name: string; icon: string; color: string; password: string }> = {
  1: { name: 'ร้านข้าว',        icon: 'fa-bowl-rice',      color: '#f97316', password: '1234' },
  2: { name: 'ร้านน้ำ',         icon: 'fa-bottle-water',   color: '#3b82f6', password: '1234' },
  3: { name: 'ร้านก๋วยเตี๋ยว', icon: 'fa-utensils',       color: '#ef4444', password: '1234' },
  4: { name: 'ร้านไก่และขนม',  icon: 'fa-drumstick-bite', color: '#eab308', password: '1234' },
}

type Tab = 'dashboard' | 'menu' | 'orders'

interface OrderItem {
  store_id: number
  item_name: string
  price: number
  quantity: number
  image?: string
}

interface StoreStatus {
  store_id: number
  status: 'pending' | 'preparing' | 'delivered'
}

interface Order {
  id: string
  table_num: string
  customer_name: string
  notes: string
  total: number
  created_at: string
  qq_order_items: OrderItem[]
  qq_store_order_status: StoreStatus[]
}

interface MenuItem {
  id: number
  name: string
  category: string
  price: number
  image: string
  is_available: boolean
}

const STATUS_LABEL: Record<string, React.ReactNode> = {
  pending:   <><i className="fa-solid fa-clock mr-1" />รอดำเนินการ</>,
  preparing: <><i className="fa-solid fa-fire-burner mr-1" />กำลังทำ</>,
  delivered: <><i className="fa-solid fa-circle-check mr-1" />จัดส่งแล้ว</>,
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  preparing: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
}

export default function AdminPage() {
  const [currentStore, setCurrentStore] = useState<number | null>(null)
  const [loginStore, setLoginStore] = useState('')
  const [password, setPassword] = useState('')
  const [tab, setTab] = useState<Tab>('dashboard')
  const [orders, setOrders] = useState<Order[]>([])
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('qq_admin_store')
    if (saved) setCurrentStore(parseInt(saved))
  }, [])

  useEffect(() => {
    if (!currentStore) return
    loadOrders()
    loadMenu()
    const interval = setInterval(loadOrders, 30000)
    return () => clearInterval(interval)
  }, [currentStore])

  function doLogin() {
    const id = parseInt(loginStore)
    if (!id || !STORES[id]) { alert('กรุณาเลือกร้าน'); return }
    if (password !== STORES[id].password) { alert('รหัสผ่านไม่ถูกต้อง'); return }
    localStorage.setItem('qq_admin_store', String(id))
    setCurrentStore(id)
  }

  function logout() {
    localStorage.removeItem('qq_admin_store')
    setCurrentStore(null)
    setOrders([])
    setMenu([])
  }

  async function loadOrders() {
    if (!currentStore) return
    setRefreshing(true)
    try {
      const res = await fetch(`/api/qq/orders?storeId=${currentStore}`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } finally {
      setRefreshing(false)
    }
  }

  async function loadMenu() {
    if (!currentStore) return
    const res = await fetch(`/api/qq/menu?storeId=${currentStore}`)
    const data = await res.json()
    setMenu(Array.isArray(data) ? data : [])
  }

  async function updateStatus(orderId: string, newStatus: string) {
    await fetch(`/api/qq/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: currentStore, status: newStatus }),
    })
    loadOrders()
  }

  async function toggleAvailability(item: MenuItem) {
    await fetch('/api/qq/menu', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, is_available: !item.is_available }),
    })
    loadMenu()
  }

  if (!currentStore) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4" style={{ backgroundColor: '#fff9e1' }}>
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-3 bg-green-50 rounded-2xl flex items-center justify-center shadow-sm overflow-hidden">
              <img src="/qq/favicon.ico" alt="QQ" className="w-12 h-12 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">
              <i className="fa-solid fa-store text-green-500 mr-2" />ระบบจัดการร้าน
            </h1>
            <p className="text-gray-500 text-sm mt-1">เลือกร้านของคุณเพื่อเริ่มต้น</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">เลือกร้าน</label>
              <select
                value={loginStore}
                onChange={(e) => setLoginStore(e.target.value)}
                className="w-full border-2 border-green-400 rounded-xl px-4 py-3 focus:outline-hidden"
              >
                <option value="">-- เลือกร้าน --</option>
                {Object.entries(STORES).map(([id, s]) => (
                  <option key={id} value={id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">รหัสผ่าน</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doLogin()}
                placeholder="รหัสผ่าน (1234)"
                className="w-full border-2 border-green-400 rounded-xl px-4 py-3 focus:outline-hidden"
              />
            </div>
            <button
              onClick={doLogin}
              className="w-full py-3 rounded-xl text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
            >
              เข้าสู่ระบบ
            </button>
          </div>
        </div>
        <a href="/QQ" className="text-blue-500 text-sm">กลับไปหน้าหลัก</a>
        <a href="/QQ/qr-generator" className="text-blue-500 text-sm">สร้าง QR Code โต๊ะ</a>
      </div>
    )
  }

  const store = STORES[currentStore]
  const myOrders = orders.filter((o) => o.qq_order_items.some((i) => i.store_id === currentStore))
  const pendingCount = myOrders.filter((o) => {
    const s = o.qq_store_order_status.find((ss) => ss.store_id === currentStore)
    return !s || s.status === 'pending' || s.status === 'preparing'
  }).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff9e1' }}>
      {/* Header */}
      <div
        className="text-white px-4 py-4 flex items-center justify-between shadow-sm"
        style={{ background: `linear-gradient(135deg, ${store.color}, #000000aa)` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/qq/favicon.ico" alt="QQ" className="w-7 h-7 object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-lg">
              <i className={`fa-solid ${store.icon} mr-2`} />{store.name}
            </h1>
            <p className="text-xs text-white/80">ระบบจัดการร้าน</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadOrders}
            className="bg-white/20 px-3 py-2 rounded-lg"
            title="รีเฟรช"
          >
            <i className={`fa-solid ${refreshing ? 'asia-spinner' : 'fa-rotate'}`} />
          </button>
          <button onClick={logout} className="bg-white/20 px-3 py-2 rounded-lg">
            <i className="fa-solid fa-right-from-bracket" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex border-b text-white"
        style={{ backgroundColor: store.color }}
      >
        {(['dashboard', 'menu', 'orders'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-3 font-semibold text-sm transition ${tab === t ? 'text-white border-b-2 border-white' : 'text-white/70'}`}
          >
            {t === 'dashboard'
              ? <><i className="fa-solid fa-chart-bar mr-1" />Dashboard</>
              : t === 'menu'
              ? <><i className="fa-solid fa-utensils mr-1" />เมนู</>
              : <><i className="fa-solid fa-box-open mr-1" />ออเดอร์</>
            }
          </button>
        ))}
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        {/* Dashboard Tab */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-gray-500 text-sm">รอดำเนินการ</p>
                <p className="text-3xl font-bold text-orange-500">{pendingCount}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-gray-500 text-sm">จำนวนเมนู</p>
                <p className="text-3xl font-bold text-green-600">{menu.length}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-bold text-lg mb-3">ออเดอร์ล่าสุด</h2>
              {myOrders.slice(0, 5).map((o) => {
                const myItems = o.qq_order_items.filter((i) => i.store_id === currentStore)
                const myTotal = myItems.reduce((s, i) => s + i.price * i.quantity, 0)
                const statusObj = o.qq_store_order_status.find((ss) => ss.store_id === currentStore)
                const status = statusObj?.status || 'pending'
                return (
                  <div key={o.id} className="border rounded-xl p-3 mb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold">โต๊ะ {o.table_num}</span>
                        <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>
                      <span className="font-bold text-purple-600">{myTotal.toLocaleString()} ฿</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {myItems.map((i) => `${i.item_name} x${i.quantity}`).join(', ')}
                    </p>
                  </div>
                )
              })}
              {myOrders.length === 0 && <p className="text-center text-gray-400 py-4">ยังไม่มีออเดอร์</p>}
            </div>
          </div>
        )}

        {/* Menu Tab */}
        {tab === 'menu' && (
          <div>
            <h2 className="text-xl font-bold mb-4">เมนูอาหาร</h2>
            {menu.length === 0 ? (
              <p className="text-center text-gray-400 py-8">ยังไม่มีเมนู</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {menu.map((item) => (
                  <div key={item.id} className={`bg-white rounded-xl shadow-sm p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
                    <div className="text-4xl text-center mb-2">
                      {item.image?.startsWith('http')
                        ? <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded-lg mx-auto" />
                        : <i className="fa-solid fa-plate-wheat text-4xl text-gray-300" />
                      }
                    </div>
                    <h3 className="font-bold text-sm text-center">{item.name}</h3>
                    <p className="text-xs text-gray-500 text-center">{item.category}</p>
                    <p className="font-bold text-center mt-1" style={{ color: store.color }}>{item.price} ฿</p>
                    <button
                      onClick={() => toggleAvailability(item)}
                      className={`mt-2 w-full text-xs py-1.5 rounded-lg font-semibold ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {item.is_available
                        ? <><i className="fa-solid fa-check mr-1" />พร้อมขาย</>
                        : <><i className="fa-solid fa-xmark mr-1" />หมด — แตะเพื่อเปิด</>
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">ออเดอร์ทั้งหมด</h2>
              <button onClick={loadOrders} className="text-sm text-blue-500">
                <i className="fa-solid fa-rotate mr-1" />รีเฟรช
              </button>
            </div>
            {myOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <i className="fa-solid fa-box-open text-5xl mb-3 block opacity-30" />
                <p>ยังไม่มีออเดอร์</p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...myOrders].reverse().map((o) => {
                  const myItems = o.qq_order_items.filter((i) => i.store_id === currentStore)
                  const myTotal = myItems.reduce((s, i) => s + i.price * i.quantity, 0)
                  const statusObj = o.qq_store_order_status.find((ss) => ss.store_id === currentStore)
                  const status = statusObj?.status || 'pending'
                  return (
                    <div key={o.id} className={`bg-white rounded-2xl shadow-sm p-4 ${status === 'delivered' ? 'opacity-60' : ''}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-xl">
                            <i className="fa-solid fa-chair mr-2 text-gray-500" />โต๊ะ {o.table_num}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {new Date(o.created_at).toLocaleString('th-TH', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {o.customer_name && o.customer_name !== '-' && (
                            <p className="text-sm text-gray-600">
                              <i className="fa-solid fa-user mr-1" />{o.customer_name}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${STATUS_COLOR[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </div>

                      <div className="bg-purple-50 rounded-xl p-3 mb-3 space-y-2">
                        {myItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white rounded-lg p-2">
                            <span className="text-sm font-medium">{item.item_name}</span>
                            <span className="font-semibold text-purple-600">×{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      {o.notes && o.notes !== '-' && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 p-2 rounded-sm mb-3 text-sm text-gray-700">
                          <i className="fa-solid fa-note-sticky mr-2 text-blue-400" />{o.notes}
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-500">ยอดรวมของร้าน</p>
                          <p className="text-2xl font-bold text-purple-600">{myTotal.toLocaleString()} ฿</p>
                        </div>
                        <div className="flex gap-2">
                          {status === 'pending' && (
                            <button
                              onClick={() => updateStatus(o.id, 'preparing')}
                              className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                            >
                              <i className="fa-solid fa-fire-burner mr-1" />เริ่มทำ
                            </button>
                          )}
                          {status === 'preparing' && (
                            <button
                              onClick={() => updateStatus(o.id, 'delivered')}
                              className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                            >
                              <i className="fa-solid fa-circle-check mr-1" />จัดส่งแล้ว
                            </button>
                          )}
                          {status === 'delivered' && (
                            <span className="text-sm text-gray-400 italic">จัดส่งเรียบร้อย</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
