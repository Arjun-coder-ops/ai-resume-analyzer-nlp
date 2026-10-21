// pages/Dashboard.jsx - Resume Analysis Workspace (Interior Design System)

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import DropZone from '../components/DropZone'
import ResultsPanel from '../components/ResultsPanel'
import HistoryCard from '../components/HistoryCard'
import Spinner from '../components/Spinner'
import ErrorBoundary from '../components/ErrorBoundary'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import api from '../utils/api'
import {
  FileText, History, PlusCircle, CircleAlert, AlertCircle,
  Clock, ArrowRight, CheckCircle2, RotateCcw, LoaderCircle, Lightbulb
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()

  // ── Form State ─────────────────────────────────────────────
  const [file, setFile] = useState(null)
  const [jobTitle, setJobTitle] = useState('')
  const [jobDesc, setJobDesc] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  // ── History & Navigation State ─────────────────────────────
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('analyze') // 'analyze' | 'history'

  // ── Real Quota State (5 trials/day) ────────────────────────
  const [quota, setQuota] = useState(null) // null indicates initial loading
  const [quotaLoading, setQuotaLoading] = useState(true)

  // Polling ref to ensure timers are always cancelled on unmount or reset
  const pollTimerRef = useRef(null)
  const isMountedRef = useRef(true)
  const consecutiveErrorsRef = useRef(0)

  // ── Polling Handler for BullMQ Background Job ───────────────
  const pollAnalysis = useCallback(
    async (id, attempt = 1) => {
      // Avoid scheduling further checks if unmounted
      if (!isMountedRef.current) return

      try {
        const { data } = await api.get(`/history/${id}`)
        consecutiveErrorsRef.current = 0
        const analysis = data?.data

        if (!analysis || !isMountedRef.current) return

        if (analysis.status === 'completed') {
          sessionStorage.removeItem('resumeiq_active_analysis')
          setResult(analysis)
          setAnalyzing(false)
          setHistory((prev) => [analysis, ...prev.filter((item) => item._id !== analysis._id)])
          loadHistory()
          loadQuota()
          setTimeout(() => {
            document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }, 150)
        } else if (analysis.status === 'failed') {
          sessionStorage.removeItem('resumeiq_active_analysis')
          setError(analysis.errorMessage || 'AI analysis failed during processing.')
          setAnalyzing(false)
          setHistory((prev) => [analysis, ...prev.filter((item) => item._id !== analysis._id)])
          loadQuota()
          loadHistory()
        } else {
          // Status is 'processing' or queued in BullMQ
          const MAX_POLLS = 80 // ~4 minutes at 3s intervals
          if (attempt >= MAX_POLLS) {
            sessionStorage.removeItem('resumeiq_active_analysis')
            setError('Analysis is taking longer than usual. Please check your history in a moment.')
            setAnalyzing(false)
            loadHistory()
          } else {
            pollTimerRef.current = setTimeout(() => {
              pollAnalysis(id, attempt + 1)
            }, 3000)
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return
        const status = err.response?.status

        // Stop polling immediately on non-retryable terminal errors
        if (status === 404) {
          sessionStorage.removeItem('resumeiq_active_analysis')
          setError('Analysis record was not found or was deleted.')
          setAnalyzing(false)
          return
        }

        if (status === 401 || status === 403) {
          sessionStorage.removeItem('resumeiq_active_analysis')
          setError('Session expired or unauthorized. Please log in again.')
          setAnalyzing(false)
          return
        }

        // On transient network error, retry up to 5 consecutive times before stopping
        consecutiveErrorsRef.current += 1
        if (consecutiveErrorsRef.current <= 5 && attempt < 80) {
          pollTimerRef.current = setTimeout(() => {
            pollAnalysis(id, attempt + 1)
          }, 3500)
        } else {
          sessionStorage.removeItem('resumeiq_active_analysis')
          setError('Lost connection to the analysis service. Please check your history later.')
          setAnalyzing(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    isMountedRef.current = true
    loadQuota()
    loadHistory()

    // Resume polling across page refreshes if an analysis was active
    const savedActiveAnalysisId = sessionStorage.getItem('resumeiq_active_analysis')
    if (savedActiveAnalysisId) {
      setAnalyzing(true)
      pollAnalysis(savedActiveAnalysisId, 1)
    }

    return () => {
      isMountedRef.current = false
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [pollAnalysis])

  // ── Refresh History on Tab Navigation ─────────────────────
  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory()
    }
  }, [activeTab])

  // ── Load Quota from Backend ────────────────────────────────
  const loadQuota = async () => {
    try {
      setQuotaLoading(true)
      const { data } = await api.get('/analyze/quota')
      if (isMountedRef.current && data?.data) {
        setQuota(data.data)
      }
    } catch {
      // If quota fetch fails, preserve safe state without hardcoding assumptions
      if (isMountedRef.current) {
        setQuota((prev) => prev || { dailyLimit: 5, trialsUsed: 0, trialsRemaining: 5 })
      }
    } finally {
      if (isMountedRef.current) setQuotaLoading(false)
    }
  }

  // ── Load History ───────────────────────────────────────────
  const loadHistory = async () => {
    try {
      setHistoryLoading(true)
      const { data } = await api.get('/history?limit=20')
      if (isMountedRef.current && Array.isArray(data?.data)) {
        setHistory(data.data)
      }
    } catch {
      // Non-critical background fetch failure
    } finally {
      if (isMountedRef.current) setHistoryLoading(false)
    }
  }

  // ── Submit Analysis ────────────────────────────────────────
  const handleAnalyze = async (e) => {
    e.preventDefault()

    if (quota && quota.trialsRemaining <= 0) {
      setError('Daily limit reached. You have completed all 5 analyses for today. Your quota resets tomorrow at midnight.')
      return
    }

    if (!file) {
      setError('Please upload your resume in PDF format.')
      return
    }

    if (!jobDesc || jobDesc.trim().length < 50) {
      setError('Job description must be at least 50 characters.')
      return
    }

    // Clear previous polling if any
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }

    setAnalyzing(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('resume', file)
      formData.append('jobDescription', jobDesc.trim())
      formData.append('jobTitle', jobTitle.trim() || 'Untitled Position')

      // Deterministically derive idempotency key from logical submission payload:
      // Same file + same jobTitle + same jobDescription => identical key across retries and repeated clicks
      // Modifying any input field or uploading a different file => brand new key
      const payloadSignature = `${file.name}_${file.size}_${file.lastModified}_${jobTitle.trim()}_${jobDesc.trim()}`
      let sigHash = 0
      for (let i = 0; i < payloadSignature.length; i++) {
        sigHash = ((sigHash << 5) - sigHash + payloadSignature.charCodeAt(i)) | 0
      }
      const idempotencyKey = `sub_${file.size}_${Math.abs(sigHash).toString(36)}`

      const { data } = await api.post('/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': idempotencyKey,
        },
      })

      loadQuota()

      const jobData = data?.data
      if (jobData?.status === 'completed') {
        // Synchronous completion fallback
        setResult(jobData)
        setAnalyzing(false)
        setHistory((prev) => [jobData, ...prev.filter((item) => item._id !== jobData._id)])
        loadHistory()
        loadQuota()
        setTimeout(() => {
          document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 150)
      } else {
        // Enqueued background job with status 'processing'
        const analysisId = jobData?.analysisId || jobData?._id
        if (analysisId) {
          sessionStorage.setItem('resumeiq_active_analysis', analysisId)
          setHistory((prev) => [
            {
              _id: analysisId,
              jobTitle: jobTitle.trim() || 'Untitled Position',
              resumeOriginalName: file?.name || 'Resume.pdf',
              status: 'processing',
              createdAt: new Date().toISOString(),
            },
            ...prev.filter((item) => item._id !== analysisId),
          ])
          pollAnalysis(analysisId, 1)
        } else {
          setError('Analysis initiated but missing reference ID.')
          setAnalyzing(false)
        }
      }
    } catch (err) {
      sessionStorage.removeItem('resumeiq_active_analysis')
      const msg =
        err.response?.data?.message ||
        'Analysis failed. Please verify the NLP service is active and try again.'
      setError(msg)
      setAnalyzing(false)
      loadQuota()
    }
  }

  // ── Reset Form ─────────────────────────────────────────────
  const handleReset = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    sessionStorage.removeItem('resumeiq_active_analysis')
    setFile(null)
    setJobTitle('')
    setJobDesc('')
    setResult(null)
    setError('')
    setAnalyzing(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const charCount = jobDesc.trim().length
  const isDescValid = charCount >= 50
  const isQuotaExhausted = quota && quota.trialsRemaining === 0

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ── Page Header & Workspace Summary ──────────────── */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-mono font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                Dashboard
              </p>
              <h1 className="font-sans text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
                Hey, {user?.name ? user.name.split(' ')[0] : 'there'}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 leading-normal">
                Evaluate your resume against target job requirements to detect skills gaps and optimize ATS compatibility.
              </p>
            </div>

            {/* Quota Indicator */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-btn bg-card border border-border/80 shadow-row text-xs">
                <span className="text-muted-foreground">Daily quota:</span>
                {quotaLoading ? (
                  <span className="font-mono text-muted-foreground">Checking…</span>
                ) : quota ? (
                  <span className={`font-mono font-medium ${isQuotaExhausted ? 'text-destructive font-semibold' : 'text-foreground'}`}>
                    {quota.trialsRemaining} of {quota.dailyLimit} remaining
                  </span>
                ) : (
                  <span className="font-mono text-muted-foreground">5 of 5 remaining</span>
                )}
              </div>

              {result && (
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                  <PlusCircle size={14} aria-hidden="true" />
                  <span>New analysis</span>
                </Button>
              )}
            </div>
          </div>

          {/* ── Tab Navigation ─────────────────────────────── */}
          <div className="flex items-center gap-2 border-b border-border/70 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('analyze')}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === 'analyze'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText size={15} aria-hidden="true" />
              <span>Analyze resume</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history')
                loadHistory()
              }}
              className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ${
                activeTab === 'history'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <History size={15} aria-hidden="true" />
              <span>History</span>
              {history.length > 0 && (
                <Badge variant="secondary" className="font-mono text-[0.6875rem] py-0 px-1.5">
                  {history.length}
                </Badge>
              )}
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════ */}
        {/* TAB: ANALYZE RESUME                                  */}
        {/* ════════════════════════════════════════════════════ */}
        {activeTab === 'analyze' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ── Left Column: Analysis Form ────────────────── */}
            <div className="lg:col-span-5 space-y-5">
              <Card className="shadow-lift">
                <CardHeader>
                  <CardTitle>Evaluation setup</CardTitle>
                  <CardDescription>
                    Provide your resume document and the target role description.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleAnalyze} className="space-y-5">
                    {/* Section 1: Resume Upload */}
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">
                        Resume document <span className="text-destructive">*</span>
                      </label>
                      <DropZone file={file} onFileChange={setFile} />
                    </div>

                    {/* Section 2: Target Position Title */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="target-job-title" className="block text-sm font-medium text-foreground">
                          Target job title
                        </label>
                        <span className="text-xs text-muted-foreground font-mono">Optional</span>
                      </div>
                      <Input
                        id="target-job-title"
                        type="text"
                        placeholder="e.g. Senior Frontend Engineer"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        disabled={analyzing}
                      />
                    </div>

                    {/* Section 3: Job Description */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="target-job-description" className="block text-sm font-medium text-foreground">
                          Job description <span className="text-destructive">*</span>
                        </label>
                        <span className={`text-xs font-mono ${charCount > 0 && !isDescValid ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {charCount} chars {charCount > 0 && !isDescValid ? `(${50 - charCount} more needed)` : '(min. 50)'}
                        </span>
                      </div>
                      <Textarea
                        id="target-job-description"
                        rows={8}
                        placeholder="Paste the full job requirements, qualifications, and core responsibilities here…"
                        value={jobDesc}
                        onChange={(e) => {
                          setJobDesc(e.target.value)
                          if (error) setError('')
                        }}
                        disabled={analyzing}
                        className="resize-none font-sans"
                        required
                      />
                    </div>

                    {/* Inline Error Notice */}
                    {error && (
                      <div
                        role="alert"
                        aria-live="polite"
                        className="p-3 rounded-badge bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2.5 animate-scale-in"
                      >
                        <CircleAlert size={16} className="shrink-0 mt-0.5" />
                        <span className="leading-snug">{error}</span>
                      </div>
                    )}

                    {/* Exhausted Quota Notice */}
                    {isQuotaExhausted && (
                      <div
                        role="alert"
                        className="p-3.5 rounded-card bg-secondary/80 border border-border text-xs text-foreground space-y-1"
                      >
                        <div className="flex items-center gap-2 font-medium text-destructive">
                          <CircleAlert size={15} />
                          <span>Daily trial limit reached</span>
                        </div>
                        <p className="text-muted-foreground leading-relaxed">
                          You have used all 5 analyses available for today. Your quota refreshes tomorrow at midnight.
                        </p>
                      </div>
                    )}

                    {/* Submit Action */}
                    <Button
                      type="submit"
                      size="lg"
                      loading={analyzing}
                      disabled={analyzing || isQuotaExhausted || !file || !isDescValid}
                      className="w-full"
                    >
                      <span>{analyzing ? 'Analyzing resume…' : 'Analyze resume'}</span>
                      {!analyzing && <ArrowRight size={15} aria-hidden="true" />}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Practical Guidance Card */}
              {!result && (
                <div className="rounded-card border border-border/70 bg-secondary/30 p-4 space-y-2.5">
                  <p className="text-xs font-medium text-foreground">For best analysis results</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Use text-based PDFs without scanned image text.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Paste the complete job description including qualifications and responsibilities.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 size={13} className="text-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      <span>Ensure standard section headings like Experience, Skills, and Education.</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* ── Right Column: Results & Progress ──────────── */}
            <div className="lg:col-span-7" id="results">
              {analyzing && <AnalyzingProgress />}

              {!analyzing && !result && !error && <EmptyWorkspaceState />}

              {!analyzing && !result && error && (
                <Card className="border-destructive/20 text-center p-8">
                  <div className="w-12 h-12 rounded-[0.375rem] bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-3 text-destructive">
                    <CircleAlert size={22} aria-hidden="true" />
                  </div>
                  <CardTitle className="text-base text-foreground mb-1">
                    Analysis could not be completed
                  </CardTitle>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed mb-4">
                    {error}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setError('')}>
                    Dismiss
                  </Button>
                </Card>
              )}

              {!analyzing && result && (
                <ErrorBoundary onReset={handleReset}>
                  <ResultsPanel data={result} />
                </ErrorBoundary>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════ */}
        {/* TAB: HISTORY                                         */}
        {/* ════════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="max-w-3xl space-y-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-24">
                <Spinner size="lg" />
              </div>
            ) : history.length === 0 ? (
              <Card className="text-center p-12">
                <div className="w-12 h-12 rounded-[0.375rem] bg-secondary border border-border flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                  <History size={20} aria-hidden="true" />
                </div>
                <CardTitle className="text-base mb-1">No past analyses</CardTitle>
                <CardDescription className="max-w-xs mx-auto mb-4">
                  Analyses you perform will be saved here so you can review match scores and skills gaps over time.
                </CardDescription>
                <Button variant="primary" size="sm" onClick={() => setActiveTab('analyze')}>
                  Start your first analysis
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {history.map((item) => (
                  <HistoryCard
                    key={item._id}
                    analysis={item}
                    onDelete={(id) => setHistory((h) => h.filter((a) => a._id !== id))}
                    onSelect={(selectedItem) => {
                      setActiveTab('analyze')
                      if (selectedItem.status === 'failed') {
                        setResult(null)
                        setError(selectedItem.errorMessage || 'This analysis failed during processing.')
                      } else if (selectedItem.status === 'processing' || selectedItem.status === 'queued' || selectedItem.status === 'pending') {
                        setResult(null)
                        setError('')
                        setAnalyzing(true)
                        sessionStorage.setItem('resumeiq_active_analysis', selectedItem._id)
                        pollAnalysis(selectedItem._id, 1)
                      } else {
                        setError('')
                        setResult(selectedItem)
                      }
                      setTimeout(() => {
                        document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' })
                      }, 100)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Lively Animated Analysis Progress ───────────────────────
const ANALYSIS_STAGES = [
  {
    label: 'Extracting document text',
    detail: 'Parsing PDF formatting, structure, and text content',
  },
  {
    label: 'Analyzing credentials & layout',
    detail: 'Detecting sections: experience, education, and technical competencies',
  },
  {
    label: 'Running neural NLP embeddings',
    detail: 'Generating semantic vector embeddings with all-MiniLM-L6-v2',
  },
  {
    label: 'Evaluating skills & match requirements',
    detail: 'Matching qualifications against target role requirements and detecting gaps',
  },
  {
    label: 'Compiling 5-pillar ATS scorecard',
    detail: 'Synthesizing scores, prioritized recommendations, and insights',
  },
]

const ROTATING_TIPS = [
  'Modern ATS algorithms evaluate semantic equivalence, recognizing related frameworks and skills beyond exact keywords.',
  'Quantified impact (e.g. percentages, team scale, revenue metrics) substantially increases ATS ranking and score.',
  'Standard headings like Experience, Skills, and Education ensure zero section skipping during parsing.',
  'Skills gap analysis prioritizes high-impact requirements to help you target your resume improvements.',
]

function AnalyzingProgress() {
  const [secondsElapsed, setSecondsElapsed] = useState(0)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % ROTATING_TIPS.length)
    }, 4500)
    return () => clearInterval(tipTimer)
  }, [])

  // Calculate current stage dynamically based on seconds elapsed
  const currentStageIndex =
    secondsElapsed < 4
      ? 0
      : secondsElapsed < 9
      ? 1
      : secondsElapsed < 16
      ? 2
      : secondsElapsed < 23
      ? 3
      : 4

  // Smoothly progressing percentage (15% -> 95%)
  const progressPercent = Math.min(
    95,
    Math.round(15 + Math.min(secondsElapsed, 30) * 2.6)
  )

  return (
    <Card className="p-6 sm:p-8 shadow-lift border border-border/90 space-y-6 animate-scale-in">
      {/* Header with active phase & elapsed time */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[0.375rem] bg-secondary border border-border flex items-center justify-center text-foreground shadow-well">
            <LoaderCircle size={20} className="animate-spin text-primary" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-primary">
                Stage {currentStageIndex + 1} of 5 · Illustrative workflow
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-border" />
              <span className="text-xs font-mono text-muted-foreground">{secondsElapsed}s elapsed</span>
            </div>
            <h3 className="font-sans text-base font-semibold text-foreground tracking-tight mt-0.5">
              {ANALYSIS_STAGES[currentStageIndex].label}
            </h3>
          </div>
        </div>

        <Badge variant="secondary" className="font-mono text-xs px-2.5 py-1 hidden sm:inline-flex">
          {progressPercent}%
        </Badge>
      </div>

      {/* Dynamic Animated Progress Bar */}
      <div className="space-y-1.5">
        <div className="h-2 w-full bg-secondary rounded-cell overflow-hidden border border-border/50">
          <div
            className="bg-primary h-full rounded-cell transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-0.5">
          <span className="truncate">{ANALYSIS_STAGES[currentStageIndex].detail}</span>
          <span className="shrink-0 ml-2 sm:hidden">{progressPercent}%</span>
        </div>
      </div>

      {/* Illustrative Pipeline Stage Sequence */}
      <div className="space-y-2 pt-1">
        {ANALYSIS_STAGES.map((stage, idx) => {
          const isCurrent = idx === currentStageIndex
          return (
            <div
              key={stage.label}
              className={`flex items-center gap-3 p-2.5 rounded-badge border text-xs transition-colors duration-200 ${
                isCurrent
                  ? 'bg-secondary/70 border-primary/40 text-foreground font-medium shadow-well'
                  : 'bg-card/50 border-border/50 text-muted-foreground'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono font-medium ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'bg-secondary border border-border/70 text-muted-foreground'
                }`}
              >
                {isCurrent ? (
                  <LoaderCircle size={11} className="animate-spin" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className={`flex-1 truncate ${isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {stage.label}
              </span>
              <span className={`text-[10px] font-mono uppercase ${isCurrent ? 'text-primary font-semibold animate-pulse' : 'text-muted-foreground/60'}`}>
                {isCurrent ? 'Processing…' : `Stage ${idx + 1}`}
              </span>
            </div>
          )
        })}
      </div>

      {/* Illustrative Workflow Disclaimer Notice */}
      <div className="p-3 bg-secondary/30 rounded-card border border-border/50 text-[11px] text-muted-foreground leading-normal">
        Note: The NLP engine executes parsing, vector embeddings, and scoring asynchronously. Stages represent standard pipeline workflow; results render automatically upon completion.
      </div>

      {/* Dynamic Rotating ATS Insight */}
      <div className="p-3.5 bg-secondary/40 rounded-card border border-border/60 flex items-start gap-2.5">
        <Lightbulb size={16} className="text-foreground shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs text-muted-foreground leading-relaxed transition-opacity duration-300">
          {ROTATING_TIPS[tipIndex]}
        </p>
      </div>
    </Card>
  )
}

// ── Empty Workspace State ────────────────────────────────────
function EmptyWorkspaceState() {
  const workflowSteps = [
    { num: '1', title: 'Upload resume', desc: 'Select your PDF file' },
    { num: '2', title: 'Target job', desc: 'Paste the job requirements' },
    { num: '3', title: 'ATS breakdown', desc: 'Review match score & gaps' },
  ]

  return (
    <Card className="p-8 sm:p-12 text-center shadow-lift border border-border/80 space-y-6">
      <div className="w-12 h-12 rounded-[0.375rem] bg-secondary border border-border flex items-center justify-center mx-auto shadow-well text-muted-foreground">
        <FileText size={22} aria-hidden="true" />
      </div>

      <div className="space-y-1.5 max-w-sm mx-auto">
        <h3 className="font-sans text-base font-semibold text-foreground tracking-tight">
          Awaiting input
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Upload your resume on the left and enter the job description to run an ATS evaluation.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto pt-2">
        {workflowSteps.map((s) => (
          <div key={s.num} className="p-3 rounded-badge bg-secondary/40 border border-border/50 text-left space-y-1">
            <span className="font-mono text-xs font-semibold text-foreground">{s.num}.</span>
            <p className="text-xs font-medium text-foreground">{s.title}</p>
            <p className="text-[11px] text-muted-foreground leading-normal">{s.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}
