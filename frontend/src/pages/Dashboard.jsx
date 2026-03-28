// pages/Dashboard.jsx - Main application dashboard

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import Navbar from '../components/Navbar'
import DropZone from '../components/DropZone'
import ResultsPanel from '../components/ResultsPanel'
import HistoryCard from '../components/HistoryCard'
import Spinner from '../components/Spinner'
import api from '../utils/api'
import {
  Zap, History, PlusCircle, Briefcase, AlertCircle,
  ChevronRight, BarChart3, Sparkles
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()

  // ── Analyzer form state ──────────────────────────────────
  const [file, setFile]           = useState(null)
  const [jobTitle, setJobTitle]   = useState('')
  const [jobDesc, setJobDesc]     = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState(null)

  // ── History state ────────────────────────────────────────
  const [history, setHistory]         = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [activeTab, setActiveTab]     = useState('analyze') // 'analyze' | 'history'

  // Load history on mount
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setHistoryLoading(true)
    try {
      const { data } = await api.get('/history?limit=20')
      setHistory(data.data)
    } catch {
      // Non-critical, just skip
    } finally {
      setHistoryLoading(false)
    }
  }

  // ── Submit analysis ──────────────────────────────────────
  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!file) { setError('Please upload your resume PDF.'); return }
    if (jobDesc.trim().length < 50) { setError('Job description must be at least 50 characters.'); return }

    setAnalyzing(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('resume', file)
      formData.append('jobDescription', jobDesc)
      formData.append('jobTitle', jobTitle.trim() || 'Untitled Position')

      const { data } = await api.post('/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (data.data && data.data.status === 'processing') {
        pollAnalysis(data.data.analysisId)
      } else {
        setResult(data.data)
        setAnalyzing(false)
        loadHistory()
        setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Analysis failed. Please check that your NLP service is running.'
      setError(msg)
      setAnalyzing(false)
    }
  }

  const pollAnalysis = async (id) => {
    try {
      const { data } = await api.get(`/history/${id}`)
      const analysis = data.data
      
      if (analysis.status === 'completed') {
        setResult(analysis)
        setAnalyzing(false)
        loadHistory()
        setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
      } else if (analysis.status === 'failed') {
        setError(analysis.errorMessage || 'AI processing failed.')
        setAnalyzing(false)
      } else {
        // Still processing or pending, queue next check
        setTimeout(() => pollAnalysis(id), 3000)
      }
    } catch (err) {
      setError('Lost connection while waiting for AI analysis.')
      setAnalyzing(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setJobTitle('')
    setJobDesc('')
    setResult(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const charCount = jobDesc.length
  const charColor = charCount < 50 ? 'text-red-400' : charCount > 3000 ? 'text-amber-400' : 'text-ink-500'

  return (
    <div className="min-h-screen bg-mesh">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Welcome banner ─────────────────────────────── */}
        <div className="mb-8 animate-fade-up">
          <p className="section-label mb-1">Dashboard</p>
          <div className="flex items-end justify-between flex-wrap gap-4">
            <h1 className="font-display text-3xl font-700 text-ink-50">
              Hey, {user?.name?.split(' ')[0]} 👋
            </h1>
            {result && (
              <button onClick={handleReset}
                className="btn-ghost flex items-center gap-2 text-sm">
                <PlusCircle size={15} />
                New Analysis
              </button>
            )}
          </div>
        </div>

        {/* ── Tab navigation ─────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 border-b border-ink-800">
          {[
            { id: 'analyze', label: 'Analyze Resume', icon: <Sparkles size={14} /> },
            { id: 'history', label: `History (${history.length})`, icon: <History size={14} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px
                ${activeTab === tab.id
                  ? 'text-volt-400 border-volt-400'
                  : 'text-ink-500 border-transparent hover:text-ink-300'
                }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════ */}
        {/* ANALYZE TAB                                      */}
        {/* ════════════════════════════════════════════════ */}
        {activeTab === 'analyze' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* ── Left: input form ─────────────────────── */}
            <div className="lg:col-span-2 space-y-5">
              <div className="glass-card p-5">
                <h2 className="font-display font-600 text-ink-100 mb-5 flex items-center gap-2">
                  <BarChart3 size={16} className="text-volt-400" />
                  Resume Input
                </h2>

                <form onSubmit={handleAnalyze} className="space-y-5">
                  {/* Upload */}
                  <div>
                    <label className="block text-ink-400 text-xs font-medium mb-2 uppercase tracking-wide">
                      Resume PDF *
                    </label>
                    <DropZone file={file} onFileChange={setFile} />
                  </div>

                  {/* Job title */}
                  <div>
                    <label className="block text-ink-400 text-xs font-medium mb-2 uppercase tracking-wide">
                      Job Title
                    </label>
                    <input
                      type="text"
                      value={jobTitle}
                      onChange={e => setJobTitle(e.target.value)}
                      placeholder="e.g. Senior React Developer"
                      className="input-field text-sm"
                    />
                  </div>

                  {/* Job description */}
                  <div>
                    <label className="block text-ink-400 text-xs font-medium mb-2 uppercase tracking-wide flex items-center justify-between">
                      <span>Job Description *</span>
                      <span className={`font-mono normal-case ${charColor}`}>{charCount} chars</span>
                    </label>
                    <textarea
                      value={jobDesc}
                      onChange={e => { setJobDesc(e.target.value); if (error) setError('') }}
                      placeholder="Paste the full job description here. Include required skills, responsibilities, and qualifications…"
                      rows={10}
                      className="input-field text-sm resize-none"
                    />
                    {charCount < 50 && charCount > 0 && (
                      <p className="text-red-400 text-xs mt-1">{50 - charCount} more characters needed</p>
                    )}
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-950/50 border border-red-800/40 animate-scale-in">
                      <AlertCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button type="submit" disabled={analyzing}
                    className="btn-volt w-full flex items-center justify-center gap-2.5 h-12">
                    {analyzing ? (
                      <>
                        <Spinner size="sm" color="white" />
                        <span className="font-display">Analyzing…</span>
                      </>
                    ) : (
                      <>
                        <Zap size={16} fill="currentColor" />
                        <span className="font-display">Analyze Resume</span>
                        <ChevronRight size={15} />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Tips card */}
              {!result && (
                <div className="glass-card p-4 border-volt-400/10 bg-volt-400/3 animate-fade-up">
                  <p className="section-label mb-2">Pro Tips</p>
                  <ul className="space-y-1.5">
                    {[
                      'Use a clean, text-based PDF resume',
                      'Paste the complete job description',
                      'Include your skills section clearly',
                    ].map((t, i) => (
                      <li key={i} className="text-xs text-ink-400 flex items-start gap-2">
                        <span className="text-volt-400 font-mono mt-0.5">→</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Right: results ───────────────────────── */}
            <div className="lg:col-span-3" id="results">
              {analyzing && <AnalyzingPlaceholder />}

              {!analyzing && !result && !error && (
                <EmptyState />
              )}

              {!analyzing && result && (
                <ResultsPanel data={result} />
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* HISTORY TAB                                      */}
        {/* ════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="max-w-2xl">
            {historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="lg" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-20 animate-fade-up">
                <div className="w-14 h-14 rounded-2xl bg-ink-800 flex items-center justify-center mx-auto mb-4">
                  <History size={22} className="text-ink-500" />
                </div>
                <p className="text-ink-400 text-sm">No analyses yet.</p>
                <button onClick={() => setActiveTab('analyze')}
                  className="btn-volt mt-4 flex items-center gap-2 mx-auto px-5 py-2.5 text-sm">
                  <Zap size={14} fill="currentColor" />
                  Run your first analysis
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((item, i) => (
                  <div key={item._id} style={{ animationDelay: `${i * 0.05}s` }}>
                    <HistoryCard
                      analysis={item}
                      onDelete={(id) => setHistory(h => h.filter(a => a._id !== id))}
                      onSelect={(a) => {
                        setActiveTab('analyze')
                        // Show the result from history
                        setResult({
                          score: a.score,
                          matchedSkills: a.matchedSkills,
                          missingSkills: a.missingSkills,
                          suggestions: a.suggestions,
                          jobTitle: a.jobTitle,
                          resumeName: a.resumeOriginalName,
                          createdAt: a.createdAt,
                        })
                        setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth' }), 100)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Loading placeholder during analysis ────────────────────
function AnalyzingPlaceholder() {
  const steps = [
    'Extracting text from PDF…',
    'Running NLP pipeline…',
    'Matching skills against job description…',
    'Calculating ATS score…',
    'Generating suggestions…',
  ]
  const [step, setStep] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, steps.length - 1)), 1200)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-volt-400/10 border border-volt-400/20 flex items-center justify-center">
          <Zap size={28} className="text-volt-400 animate-pulse-slow" fill="currentColor" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border border-volt-400/10 animate-ping opacity-30" />
      </div>
      <h3 className="font-display font-700 text-ink-100 text-lg mb-2">Analyzing Your Resume</h3>
      <p className="text-volt-400 text-sm font-mono mb-8 h-5 transition-all">{steps[step]}</p>
      <div className="w-full max-w-xs space-y-2">
        {steps.map((s, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all duration-700 ${i <= step ? 'bg-volt-400' : 'bg-ink-800'}`}
            style={{ width: i <= step ? '100%' : `${20 + i * 15}%`, opacity: i <= step ? 1 : 0.3 }} />
        ))}
      </div>
    </div>
  )
}

// ── Empty state before first analysis ──────────────────────
function EmptyState() {
  return (
    <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-ink-800 flex items-center justify-center mb-5">
        <Briefcase size={26} className="text-ink-500" />
      </div>
      <h3 className="font-display font-600 text-ink-300 text-base mb-2">No Analysis Yet</h3>
      <p className="text-ink-500 text-sm max-w-xs leading-relaxed">
        Upload your resume and paste a job description to get your ATS compatibility score with matched and missing skills.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4 w-full max-w-xs">
        {['Upload PDF', 'Paste JD', 'Get Score'].map((step, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-ink-800 border border-ink-700 flex items-center justify-center">
              <span className="font-mono text-xs text-ink-400">{i + 1}</span>
            </div>
            <span className="text-ink-600 text-xs">{step}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
