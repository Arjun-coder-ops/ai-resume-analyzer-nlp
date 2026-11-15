import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Eye, EyeOff, ArrowRight, CircleAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const { login, register } = useAuth()
  const root = useRef(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('[data-auth-enter]', {
        opacity: 0,
        y: 18,
        duration: .55,
        ease: 'power3.out',
        stagger: .07,
      })
    })
    return () => media.revert()
  }, { scope: root, dependencies: [mode] })

  useEffect(() => {
    setError('')
    setShowPw(false)
    setShowConfirmPw(false)
    setForm((current) => ({ ...current, password: '', confirmPassword: '' }))
  }, [mode])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (!form.email.trim()) return setError('Enter the email address for your account.')
    if (!isLogin && !form.name.trim()) return setError('Enter your full name to create an account.')
    if (!isLogin && form.password.length < 6) return setError('Choose a password with at least 6 characters.')
    if (!isLogin && form.password !== form.confirmPassword) return setError('The two password entries do not match.')
    if (isLogin && !form.password) return setError('Enter your password to sign in.')

    setLoading(true)
    try {
      if (isLogin) await login(form.email.trim(), form.password)
      else await register(form.name.trim(), form.email.trim(), form.password, form.confirmPassword)
      navigate('/dashboard')
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.errors?.[0]?.msg || 'We could not authenticate that account. Check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-rebuild" ref={root}>
      <aside className="auth-rebuild__aside" aria-label="ResumeIQ account context">
        <Link className="auth-rebuild__brand" to="/" data-auth-enter>
          <span className="auth-rebuild__mark" aria-hidden="true">IQ</span>
          <span>ResumeIQ</span>
        </Link>
        <div className="auth-rebuild__aside-copy" data-auth-enter>
          <p>Career intelligence workspace</p>
          <h2>Keep the evidence close to the decision.</h2>
          <p>Use your private workspace to submit resumes, review completed analyses, and return to documents you own.</p>
        </div>
        <p className="auth-rebuild__aside-note" data-auth-enter>Private documents are only available through your authenticated account.</p>
      </aside>

      <section className="auth-rebuild__main" aria-labelledby="auth-title">
        <div className="auth-rebuild__form">
          <Link className="auth-rebuild__back" to="/" data-auth-enter>Back to ResumeIQ</Link>
          <p className="auth-rebuild__eyebrow" data-auth-enter>{isLogin ? 'Welcome back' : 'Create an account'}</p>
          <h1 id="auth-title" data-auth-enter>{isLogin ? 'Open your workspace.' : 'Start with your next role.'}</h1>
          <p className="auth-rebuild__intro" data-auth-enter>
            {isLogin ? <>Need an account? <Link to="/register">Create one here</Link>.</> : <>Already have an account? <Link to="/login">Sign in here</Link>.</>}
          </p>

          {error && (
            <div className="auth-rebuild__error" role="alert" aria-live="polite">
              <CircleAlert size={17} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-rebuild__fields" noValidate data-auth-enter>
            {!isLogin && (
              <div className="auth-rebuild__field">
                <label htmlFor="auth-name">Full name</label>
                <Input id="auth-name" name="name" type="text" autoComplete="name" placeholder="Your name" value={form.name} onChange={handleChange} disabled={loading} required aria-invalid={Boolean(error && !form.name.trim())} />
              </div>
            )}
            <div className="auth-rebuild__field">
              <label htmlFor="auth-email">Email address</label>
              <Input id="auth-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" value={form.email} onChange={handleChange} disabled={loading} required aria-invalid={Boolean(error && !form.email.trim())} />
            </div>
            <div className="auth-rebuild__field">
              <div className="auth-rebuild__label-row">
                <label htmlFor="auth-password">Password</label>
                {!isLogin && <span className="auth-rebuild__hint">6 characters minimum</span>}
              </div>
              <div className="auth-rebuild__password">
                <Input id="auth-password" name="password" type={showPw ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={isLogin ? 'Enter your password' : 'Create a password'} value={form.password} onChange={handleChange} disabled={loading} required aria-invalid={Boolean(error && !form.password)} />
                <button type="button" onClick={() => setShowPw((visible) => !visible)} aria-label={showPw ? 'Hide password' : 'Show password'}>{showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
              </div>
            </div>
            {!isLogin && (
              <div className="auth-rebuild__field">
                <label htmlFor="auth-confirm-password">Confirm password</label>
                <div className="auth-rebuild__password">
                  <Input id="auth-confirm-password" name="confirmPassword" type={showConfirmPw ? 'text' : 'password'} autoComplete="new-password" placeholder="Enter it again" value={form.confirmPassword} onChange={handleChange} disabled={loading} required aria-invalid={Boolean(error && form.password !== form.confirmPassword)} />
                  <button type="button" onClick={() => setShowConfirmPw((visible) => !visible)} aria-label={showConfirmPw ? 'Hide password confirmation' : 'Show password confirmation'}>{showConfirmPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}</button>
                </div>
              </div>
            )}
            <Button type="submit" loading={loading} disabled={loading} size="lg" className="auth-rebuild__submit">
              <span>{isLogin ? 'Sign in to workspace' : 'Create account'}</span>{!loading && <ArrowRight size={16} aria-hidden="true" />}
            </Button>
          </form>
          <p className="auth-rebuild__terms" data-auth-enter>By continuing, you agree to the ResumeIQ terms of service and privacy notice.</p>
        </div>
      </section>
    </main>
  )
}
