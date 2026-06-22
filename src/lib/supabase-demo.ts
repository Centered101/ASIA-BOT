import { createClient } from '@supabase/supabase-js'

// Untyped client for QQ and Qman demo tables (not in auto-generated Database type)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabaseDemo = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
