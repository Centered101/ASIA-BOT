export interface QmanCategory {
  id: number
  name: string
  icon: string
  color_from: string
  color_to: string
}

export interface QmanShop {
  id: number
  category_id: number
  name: string
  branch: string
  logo_url: string
  map_url: string
  price_per_booking: number
  badge: string
}

export interface QmanUser {
  id: string
  email: string
  wallet_balance: number
  created_at: string
}

export interface QmanBooking {
  id: string
  queue_number: string
  user_id: string | null
  shop_id: number | null
  shop_name: string
  shop_branch: string
  shop_logo: string
  shop_map: string
  customer_name: string
  customer_phone: string
  booking_date: string
  booking_time: string
  notes: string
  price: number
  status: string
  created_at: string
}
