// pages/AuthPage.jsx - Interior Design System Authentication

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff, ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

export default function AuthPage({ mode = 'login' }) {
  const isLogin = mode === 'login'
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPw, setShowPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Clear errors and sensitive fields when switching modes
  useEffect(() => {
    setError('')
    setShowPw(false)
    setShowConfirmPw(false)
    setForm((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
    }))
  }, [mode])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Client-side validation checks before hitting the API
    if (!form.email.trim()) {
      setError('Please enter your email address.')
      return
    }

    if (!isLogin) {
      if (!form.name.trim()) {
        setError('Full name is required.')
        return
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    } else {
      if (!form.password) {
        setError('Please enter your password.')
        return
      }
    }

    setLoading(true)
    try {
      if (isLogin) {
        await login(form.email.trim(), form.password)
      } else {
        await register(
          form.name.trim(),
          form.email.trim(),
          form.password,
          form.confirmPassword
        )
      }
      navigate('/dashboard')
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.msg ||
        'Authentication failed. Please verify your credentials and try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const features = [
    {
      title: 'Semantic skills matching',
      desc: 'Compares your actual resume text against job requirements with NLP.',
    },
    {
      title: 'ATS compatibility scoring',
      desc: 'Breaks down keywords, experience alignment, credentials, and impact.',
    },
    {
      title: 'Actionable gap analysis',
      desc: 'Highlights missing skills and provides concrete suggestions to improve match rate.',
    },
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ── Left panel: Product positioning & brand (desktop) ── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 lg:p-16 border-r border-border/80 bg-secondary/30">
        {/* Brand header */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[0.375rem] bg-primary text-primary-foreground flex items-center justify-center shadow-cap select-none">
            <span className="font-sans font-bold text-sm tracking-tight">IQ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-lg text-foreground tracking-tight">
              ResumeIQ
            </span>
            <Badge variant="secondary" className="text-[0.6875rem] font-mono border-border/60">
              ATS Studio
            </Badge>
          </div>
        </div>

        {/* Value proposition & highlights */}
        <div className="max-w-md my-auto space-y-8">
          <div className="space-y-3">
            <h1 className="font-sans text-3xl xl:text-4xl font-semibold text-foreground tracking-tight leading-tight">
              Optimize your resume for applicant tracking systems.
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Compare your experience against target job descriptions with precision semantic analysis, gap detection, and verifiable recommendations.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-[0.3125rem] bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-row">
                  <CheckCircle2 size={12} className="text-foreground" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{f.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-normal">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sample inspection card conforming to Interior DS */}
          <div className="rounded-card border border-border/80 bg-card p-4 shadow-lift space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Sample Evaluation</span>
              <Badge variant="success">84 / 100 Match</Badge>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Senior Software Engineer</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <span>12 skills aligned</span>
                <span>·</span>
                <span>2 recommendations</span>
              </div>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-cell overflow-hidden border border-border/50">
              <div className="bg-primary h-full rounded-cell" style={{ width: '84%' }} />
            </div>
          </div>
        </div>

        {/* Security assurance */}
        <div className="text-xs text-muted-foreground">
          <span>Private and secure resume parsing · No data sold or shared</span>
        </div>
      </div>

      {/* ── Right panel: Authentication form ─────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile brand mark */}
          <div className="flex items-center gap-2.5 lg:hidden mb-2">
            <div className="w-7 h-7 rounded-[0.375rem] bg-primary text-primary-foreground flex items-center justify-center shadow-cap select-none">
              <span className="font-sans font-bold text-xs tracking-tight">IQ</span>
            </div>
            <span className="font-sans font-semibold text-base text-foreground tracking-tight">
              ResumeIQ
            </span>
          </div>

          {/* Card wrapper */}
          <Card className="border border-border/90 shadow-lift">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold">
                {isLogin ? 'Sign in to ResumeIQ' : 'Create your account'}
              </CardTitle>
              <CardDescription>
                {isLogin ? (
                  <>
                    New to ResumeIQ?{' '}
                    <Link
                      to="/register"
                      className="text-foreground font-medium underline underline-offset-4 hover:text-accent-foreground transition-colors"
                    >
                      Create an account
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <Link
                      to="/login"
                      className="text-foreground font-medium underline underline-offset-4 hover:text-accent-foreground transition-colors"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Error notification */}
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-5 p-3 rounded-badge bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-scale-in"
                >
                  <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full name (registration only) */}
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-name"
                      className="block text-sm font-medium text-foreground"
                    >
                      Full name
                    </label>
                    <Input
                      id="auth-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Alex Chen"
                      value={form.name}
                      onChange={handleChange}
                      autoComplete="name"
                      disabled={loading}
                      required
                    />
                  </div>
                )}

                {/* Email address */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-email"
                    className="block text-sm font-medium text-foreground"
                  >
                    Email address
                  </label>
                  <Input
                    id="auth-email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={handleChange}
                    autoComplete="email"
                    disabled={loading}
                    required
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-password"
                      className="block text-sm font-medium text-foreground"
                    >
                      Password
                    </label>
                    {!isLogin && (
                      <span className="text-xs text-muted-foreground font-mono">
                        Min. 6 characters
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="auth-password"
                      name="password"
                      type={showPw ? 'text' : 'password'}
                      placeholder={isLogin ? '••••••••' : 'Create password'}
                      value={form.password}
                      onChange={handleChange}
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                      disabled={loading}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-badge transition-colors"
                    >
                      {showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password (registration only) */}
                {!isLogin && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-sm font-medium text-foreground"
                    >
                      Confirm password
                    </label>
                    <div className="relative">
                      <Input
                        id="auth-confirm-password"
                        name="confirmPassword"
                        type={showConfirmPw ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        autoComplete="new-password"
                        disabled={loading}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-badge transition-colors"
                      >
                        {showConfirmPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  disabled={loading}
                  className="w-full mt-2"
                >
                  <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                  {!loading && <ArrowRight size={15} aria-hidden="true" />}
                </Button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-5 leading-normal">
                By continuing, you agree to ResumeIQ's terms of service and privacy notice.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
