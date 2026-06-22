'use client'

import { useState, useEffect, useRef } from 'react'

interface QREntry {
  table: number
  url: string
  dataUrl: string
}

export default function QRGeneratorPage() {
  const [tableCount, setTableCount] = useState(10)
  const [baseUrl, setBaseUrl] = useState('')
  const [qrList, setQrList] = useState<QREntry[]>([])
  const [generating, setGenerating] = useState(false)
  const initialized = useRef(false)

  useEffect(() => {
    setBaseUrl(window.location.origin + '/QQ')
    const saved = localStorage.getItem('qq_qr_list')
    if (saved) setQrList(JSON.parse(saved))
  }, [])

  async function generate() {
    setGenerating(true)
    try {
      const QRCode = (await import('qrcode')).default
      const entries: QREntry[] = []
      for (let i = 1; i <= tableCount; i++) {
        const url = `${baseUrl}?table=${i}`
        const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 })
        entries.push({ table: i, url, dataUrl })
      }
      setQrList(entries)
      localStorage.setItem('qq_qr_list', JSON.stringify(entries))
    } finally {
      setGenerating(false)
    }
  }

  function download(entry: QREntry) {
    const a = document.createElement('a')
    a.href = entry.dataUrl
    a.download = `QR_Table_${entry.table}.png`
    a.click()
  }

  function downloadAll() {
    qrList.forEach((e, i) => {
      setTimeout(() => download(e), i * 100)
    })
  }

  function clearAll() {
    if (!confirm('ต้องการลบ QR Code ทั้งหมด?')) return
    setQrList([])
    localStorage.removeItem('qq_qr_list')
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff9e1' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 text-white px-4 py-4 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <a href="/QQ/admin" className="text-white/80 text-2xl">←</a>
          <div>
            <h1 className="text-xl font-bold">📱 สร้าง QR Code โต๊ะ</h1>
            <p className="text-xs text-white/80">สำหรับให้ลูกค้าสแกนสั่งอาหาร</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Config */}
        <div className="bg-white rounded-2xl shadow p-4 space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">URL หน้าสั่งอาหาร</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">จำนวนโต๊ะ</label>
            <input
              type="number"
              min={1}
              max={50}
              value={tableCount}
              onChange={(e) => setTableCount(parseInt(e.target.value) || 1)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm focus:border-green-500 focus:outline-none"
            />
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="w-full py-3 rounded-xl text-white font-bold disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
          >
            {generating ? 'กำลังสร้าง QR Code...' : '✨ สร้าง QR Code'}
          </button>
        </div>

        {/* QR Grid */}
        {qrList.length > 0 && (
          <>
            <div className="flex gap-2">
              <button
                onClick={downloadAll}
                className="flex-1 py-2 rounded-xl text-white text-sm font-semibold"
                style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
              >
                ⬇️ ดาวน์โหลดทั้งหมด
              </button>
              <button
                onClick={clearAll}
                className="px-4 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-semibold"
              >
                🗑️ ลบทั้งหมด
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {qrList.map((entry) => (
                <div key={entry.table} className="bg-white rounded-2xl shadow p-4 text-center">
                  <p className="font-bold text-gray-800 mb-2">โต๊ะที่ {entry.table}</p>
                  <img src={entry.dataUrl} alt={`QR Table ${entry.table}`} className="w-full max-w-[150px] mx-auto mb-2 rounded" />
                  <p className="text-xs text-gray-400 break-all mb-2">{entry.url}</p>
                  <button
                    onClick={() => download(entry)}
                    className="w-full py-1.5 rounded-lg text-white text-xs font-semibold"
                    style={{ background: 'linear-gradient(135deg, #1ed760, #16a34a)' }}
                  >
                    ⬇️ ดาวน์โหลด
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
