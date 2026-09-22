// pages/AuthPage.jsx - Login / Register page

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, Zap, ArrowRight, CheckCircle2 } from 'lucide-react'
import Spinner from '../components/Spinner'

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const [form, setForm]       = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPw, setShowPw]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isLogin) {
        await login(form.email, form.password)
      } else {
        if (!form.name.trim()) { setError('Name is required'); setLoading(false); return }
        if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); setLoading(false); return }
        await register(form.name, form.email, form.password, form.confirmPassword)
      }
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message
        || err.response?.data?.errors?.[0]?.msg
        || 'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    'AI-powered ATS score analysis',
    'Real-time skills gap detection',
    'Tailored improvement suggestions',
    'Beat 95% of ATS filters',
  ]

  return (
    <div className="min-h-screen bg-mesh flex">
      {/* ── Left panel: branding ───────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 border-r border-ink-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-volt-400 flex items-center justify-center">
            <Zap size={18} className="text-ink-900" fill="currentColor" />
          </div>
          <span className="font-display font-700 text-xl text-ink-100 tracking-tight">ResumeIQ</span>
        </div>

        <div className="space-y-10">
          <div>
            <p className="section-label mb-4">ATS Optimizer</p>
            <h1 className="font-display text-5xl font-800 text-ink-50 leading-tight">
              Land more<br />
              <span className="text-volt-400">interviews.</span>
            </h1>
            <p className="mt-4 text-ink-400 text-lg leading-relaxed max-w-sm">
              Our AI analyzes your resume against any job description and gives you an exact ATS score with actionable improvements.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-ink-300">
                <CheckCircle2 size={16} className="text-volt-400 flex-shrink-0" />
                <span className="text-sm">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative score widget */}
        <div className="glass-card p-5 max-w-xs">
          <p className="text-ink-400 text-xs font-mono uppercase tracking-wider mb-3">Latest Analysis</p>
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#a0f000" strokeWidth="3"
                  strokeDasharray="72 100" strokeLinecap="round"/>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-xs font-700 text-volt-400">72</span>
            </div>
            <div>
              <p className="text-ink-100 text-sm font-medium">Senior React Dev</p>
              <p className="text-ink-500 text-xs mt-0.5">8 matched · 4 missing</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: form ──────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-fade-up">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-volt-400 flex items-center justify-center">
              <Zap size={15} className="text-ink-900" fill="currentColor" />
            </div>
            <span className="font-display font-700 text-lg text-ink-100">ResumeIQ</span>
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-700 text-ink-50">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-ink-400 mt-1.5">
              {isLogin ? "Don't have an account? " : 'Already have one? '}
              <Link to={isLogin ? '/register' : '/login'}
                className="text-volt-400 hover:text-volt-300 font-medium transition-colors">
                {isLogin ? 'Sign up free' : 'Sign in'}
              </Link>
            </p>
          </div>

          {/* Error alert */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-xl bg-red-950/60 border border-red-800/50 text-red-300 text-sm animate-scale-in">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-ink-400 text-sm mb-1.5">Full name</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Alex Johnson"
                  value={form.name}
                  onChange={handleChange}
                  className="input-field"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="block text-ink-400 text-sm mb-1.5">Email address</label>
              <input
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                className="input-field"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-ink-400 text-sm mb-1.5">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder={isLogin ? '••••••••' : 'Min. 6 characters'}
                  value={form.password}
                  onChange={handleChange}
                  className="input-field pr-12"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300 transition-colors">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-ink-400 text-sm mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    className="input-field pr-12"
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-500 hover:text-ink-300 transition-colors">
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-volt w-full flex items-center justify-center gap-2 mt-2 h-12">
              {loading ? (
                <><Spinner size="sm" color="white" /><span>Please wait…</span></>
              ) : (
                <><span>{isLogin ? 'Sign in' : 'Create account'}</span><ArrowRight size={16} /></>
              )}
            </button>
          </form>

          <p className="text-center text-ink-600 text-xs mt-6">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  )
}
