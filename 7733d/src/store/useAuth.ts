import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cloudConfigured, supabase } from '../cloud.js'

export type AuthResult = { ok: boolean; message?: string; needsConfirmation?: boolean }

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'ایمیل یا رمز عبور درست نیست.'
  if (normalized.includes('email not confirmed')) return 'ابتدا ایمیل خود را تأیید کن؛ لینک تأیید برایت ارسال شده است.'
  if (normalized.includes('user already registered')) return 'این ایمیل قبلاً ثبت شده است. وارد شو یا رمز عبور را بازیابی کن.'
  if (normalized.includes('password should be at least')) return 'رمز عبور باید حداقل ۶ نویسه باشد.'
  if (normalized.includes('unable to validate email')) return 'قالب ایمیل معتبر نیست.'
  if (normalized.includes('rate limit')) return 'تعداد تلاش‌ها زیاد بوده است؛ کمی بعد دوباره تلاش کن.'
  if (normalized.includes('network') || normalized.includes('fetch')) return 'اتصال به سرور برقرار نشد؛ اتصال اینترنت را بررسی کن.'
  return message
}

export function useAuth() {
  const configured = cloudConfigured()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!configured)
  const [busy, setBusy] = useState(false)
  const [startupError, setStartupError] = useState('')

  useEffect(() => {
    const client = supabase
    if (!client) {
      setReady(true)
      return
    }
    let alive = true
    void client.auth.getSession()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setStartupError(translateAuthError(error.message))
        setSession(data.session)
        setReady(true)
      })
      .catch((error: unknown) => {
        if (!alive) return
        setStartupError(error instanceof Error ? translateAuthError(error.message) : 'بررسی نشست کاربری ناموفق بود.')
        setReady(true)
      })
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setReady(true)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = supabase
    if (!client) return { ok: false, message: 'اتصال ابری تنظیم نشده است.' }
    setBusy(true)
    try {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
      if (error) return { ok: false, message: translateAuthError(error.message) }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? translateAuthError(error.message) : 'ورود ناموفق بود.' }
    } finally {
      setBusy(false)
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const client = supabase
    if (!client) return { ok: false, message: 'اتصال ابری تنظیم نشده است.' }
    setBusy(true)
    try {
      const { data, error } = await client.auth.signUp({ email: email.trim(), password })
      if (error) return { ok: false, message: translateAuthError(error.message) }
      if (!data.session) {
        return { ok: true, needsConfirmation: true, message: 'حساب ساخته شد؛ لینک تأیید را از ایمیل باز کن و سپس وارد شو.' }
      }
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? translateAuthError(error.message) : 'ساخت حساب ناموفق بود.' }
    } finally {
      setBusy(false)
    }
  }, [])

  const signOut = useCallback(async (): Promise<AuthResult> => {
    const client = supabase
    if (!client) return { ok: true }
    const { error } = await client.auth.signOut()
    return error ? { ok: false, message: translateAuthError(error.message) } : { ok: true }
  }, [])

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const client = supabase
    if (!client) return { ok: false, message: 'اتصال ابری تنظیم نشده است.' }
    setBusy(true)
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + window.location.pathname,
      })
      if (error) return { ok: false, message: translateAuthError(error.message) }
      return { ok: true, message: 'لینک بازیابی رمز عبور به ایمیل ارسال شد.' }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? translateAuthError(error.message) : 'ارسال ایمیل بازیابی ناموفق بود.' }
    } finally {
      setBusy(false)
    }
  }, [])

  return {
    configured,
    ready,
    session,
    user: session?.user ?? null,
    email: session?.user.email ?? '',
    busy,
    startupError,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
