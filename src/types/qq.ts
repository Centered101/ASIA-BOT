export interface QQStore {
  id: number
  name: string
  icon: string
  color: string
  color1: string
  color2: string
}

export interface QQMenuItem {
  id: number
  store_id: number
  name: string
  category: string
  price: number
  image: string
  is_available: boolean
  created_at?: string
}

export interface QQOrder {
  id: string
  table_num: string
  customer_name: string
  total: number
  notes: string
  created_at: string
}

export interface QQOrderItem {
  id: number
  order_id: string
  store_id: number
  item_name: string
  price: number
  quantity: number
  image: string
}

export interface QQStoreOrderStatus {
  id: number
  order_id: string
  store_id: number
  status: 'pending' | 'preparing' | 'delivered'
  updated_at: string
}

export interface QQCartItem {
  id: number
  name: string
  price: number
  category: string
  image: string
  quantity: number
  storeId: number
}

export interface QQOrderWithItems extends QQOrder {
  items: (QQOrderItem & { store_name?: string })[]
  store_statuses: QQStoreOrderStatus[]
}
