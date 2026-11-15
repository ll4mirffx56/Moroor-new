import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const publishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

export const supabase = url && publishableKey ? createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null

export function cloudConfigured(): boolean {
  return Boolean(supabase)
}

export const CLOUD_SETUP_HINT = 'برای همگام‌سازی، متغیرهای VITE_SUPABASE_URL و VITE_SUPABASE_PUBLISHABLE_KEY را تنظیم کن و migrationهای پوشهٔ supabase/migrations را اجرا کن.'
