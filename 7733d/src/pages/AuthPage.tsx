import { useState, type FormEvent } from 'react'
import { ArrowLeft, BookOpenCheck, CalendarCheck2, ChartLine, Loader2, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import type { useAuth } from '../store/useAuth.js'
import { Button, Callout, Field, Input } from '../components/ui.js'

type Mode = 'login' | 'register' | 'reset'

export function AuthPage({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setSuccess('')
    setPassword('')
    setConfirm('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')
    const cleanEmail = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('ایمیل معتبر وارد کن.')
      return
    }
    if (mode !== 'reset') {
      if (password.length < 6) { setError('رمز عبور باید حداقل ۶ نویسه باشد.'); return }
      if (mode === 'register' && password !== confirm) { setError('تکرار رمز عبور با رمز اصلی یکسان نیست.'); return }
    }

    if (mode === 'login') {
      const result = await auth.signIn(cleanEmail, password)
      if (!result.ok) setError(result.message ?? 'ورود ناموفق بود.')
      return
    }
    if (mode === 'register') {
      const result = await auth.signUp(cleanEmail, password)
      if (!result.ok) { setError(result.message ?? 'ساخت حساب ناموفق بود.'); return }
      setSuccess(result.message ?? 'حساب ساخته شد. اکنون می‌توانی وارد شوی.')
      if (!result.needsConfirmation) switchMode('login')
      return
    }
    const result = await auth.resetPassword(cleanEmail)
    if (!result.ok) setError(result.message ?? 'ارسال لینک بازیابی ناموفق بود.')
    else setSuccess(result.message ?? 'لینک بازیابی ارسال شد.')
  }

  const title = mode === 'login' ? 'ورود به حساب' : mode === 'register' ? 'ساخت حساب' : 'بازیابی رمز عبور'

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <div className="brand brand-auth">
          <div className="brand-mark" aria-hidden="true">م</div>
          <div>
            <strong>مرور</strong>
            <span>Moroor V2</span>
          </div>
        </div>
        <h1>سیستم شخصی مدیریت یادگیری</h1>
        <p>
          مطالعه، مرور فاصله‌دار، آزمون، دوره و گزارش پیشرفت را در یک پروندهٔ یادگیری حساب‌محور نگه دار.
          اطلاعات با همان حساب بین موبایل و کامپیوتر همگام می‌شود.
        </p>
        <ul className="auth-features">
          <li><CalendarCheck2 size={18} /><span>مرور فاصله‌دار با تاریخ شمسی</span></li>
          <li><ChartLine size={18} /><span>تحلیل آزمون و مقایسهٔ درس و مبحث</span></li>
          <li><BookOpenCheck size={18} /><span>پیشرفت واقعی یادگیری جدا از ویدئو</span></li>
          <li><ShieldCheck size={18} /><span>دسترسی هر کاربر فقط به اطلاعات خودش</span></li>
        </ul>
        <p className="auth-note">اطلاعات بدون ورود، روی حساب کاربری ذخیره نمی‌شود و داشبورد پیش از احراز هویت نمایش داده نمی‌شود.</p>
      </aside>

      <main className="auth-panel">
        <div className="auth-card">
          <header>
            <h2>{title}</h2>
            <p>{mode === 'login' ? 'برای دیدن داشبورد وارد شو.' : mode === 'register' ? 'حساب جدید بساز تا اطلاعاتت همگام شود.' : 'ایمیل حسابت را وارد کن.'}</p>
          </header>

          {auth.startupError ? <Callout tone="warning" title="بررسی نشست">{auth.startupError}</Callout> : null}

          <form onSubmit={submit} className="auth-form">
            <Field label="ایمیل" required>
              <div className="input-with-icon">
                <Mail size={16} aria-hidden="true" />
                <Input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} dir="ltr" placeholder="you@example.com" />
              </div>
            </Field>
            {mode !== 'reset' ? (
              <Field label="رمز عبور" required>
                <div className="input-with-icon">
                  <LockKeyhole size={16} aria-hidden="true" />
                  <Input
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    dir="ltr"
                    placeholder="حداقل ۶ نویسه"
                  />
                </div>
              </Field>
            ) : null}
            {mode === 'register' ? (
              <Field label="تکرار رمز عبور" required>
                <div className="input-with-icon">
                  <LockKeyhole size={16} aria-hidden="true" />
                  <Input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} dir="ltr" />
                </div>
              </Field>
            ) : null}

            {error ? <p className="form-error" role="alert">{error}</p> : null}
            {success ? <p className="form-success" role="status">{success}</p> : null}

            <Button type="submit" full disabled={auth.busy} icon={auth.busy ? <Loader2 size={16} className="spin" /> : <ArrowLeft size={16} />}>
              {mode === 'login' ? 'ورود' : mode === 'register' ? 'ساخت حساب' : 'ارسال لینک بازیابی'}
            </Button>
          </form>

          <div className="auth-links">
            {mode !== 'login' ? <button type="button" className="link-button" onClick={() => switchMode('login')}>بازگشت به ورود</button> : null}
            {mode === 'login' ? (
              <>
                <button type="button" className="link-button" onClick={() => switchMode('register')}>ساخت حساب جدید</button>
                <button type="button" className="link-button" onClick={() => switchMode('reset')}>رمز عبور را فراموش کرده‌ام</button>
              </>
            ) : null}
          </div>

          <p className="auth-legal">
            با ورود، اطلاعاتت در حساب Supabase همین پروژه ذخیره می‌شود. رمز عبور و کلید سرویس در برنامهٔ سمت کاربر ذخیره نمی‌شود.
          </p>
        </div>
      </main>
    </div>
  )
}
