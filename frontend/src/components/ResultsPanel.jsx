// components/ResultsPanel.jsx - Full analysis results display

import { CheckCircle2, XCircle, Lightbulb, Briefcase, FileText, Clock } from 'lucide-react'
import ScoreRing from './ScoreRing'

export default function ResultsPanel({ data }) {
  const { score, matchedSkills, missingSkills, suggestions, jobTitle, resumeName, createdAt } = data

  const formatDate = (d) =>
    new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4 animate-fade-up">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="section-label mb-0.5">Analysis Complete</p>
          <h3 className="font-display font-700 text-ink-100 text-lg">{jobTitle || 'Position Analysis'}</h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-500">
          <span className="flex items-center gap-1.5"><FileText size={12} />{resumeName}</span>
          <span className="flex items-center gap-1.5"><Clock size={12} />{formatDate(createdAt)}</span>
        </div>
      </div>

      {/* ── Score + quick stats ──────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-6 flex items-center justify-center sm:row-span-1">
          <ScoreRing score={score} />
        </div>

        <div className="sm:col-span-2 grid grid-cols-2 gap-4">
          <StatCard
            icon={<CheckCircle2 size={18} className="text-volt-400" />}
            value={matchedSkills.length}
            label="Matched Skills"
            color="volt"
          />
          <StatCard
            icon={<XCircle size={18} className="text-red-400" />}
            value={missingSkills.length}
            label="Missing Skills"
            color="red"
          />
          <StatCard
            icon={<Briefcase size={18} className="text-blue-400" />}
            value={matchedSkills.length + missingSkills.length}
            label="JD Skills Total"
            color="blue"
          />
          <StatCard
            icon={<Lightbulb size={18} className="text-amber-400" />}
            value={suggestions.length}
            label="Suggestions"
            color="amber"
          />
        </div>
      </div>

      {/* ── Skills grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Matched */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={15} className="text-volt-400" />
            <h4 className="font-display font-600 text-ink-100 text-sm">Matched Skills</h4>
            <span className="ml-auto text-xs font-mono text-volt-400 bg-volt-400/10 px-2 py-0.5 rounded-full">
              {matchedSkills.length}
            </span>
          </div>
          {matchedSkills.length === 0 ? (
            <p className="text-ink-500 text-sm">No matching skills found.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {matchedSkills.map((skill, i) => (
                <span key={i} className="badge-matched animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <CheckCircle2 size={10} />
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Missing */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <XCircle size={15} className="text-red-400" />
            <h4 className="font-display font-600 text-ink-100 text-sm">Missing Skills</h4>
            <span className="ml-auto text-xs font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
              {missingSkills.length}
            </span>
          </div>
          {missingSkills.length === 0 ? (
            <p className="text-volt-400 text-sm flex items-center gap-1.5">
              <CheckCircle2 size={14} /> All required skills matched!
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {missingSkills.map((skill, i) => (
                <span key={i} className="badge-missing animate-scale-in" style={{ animationDelay: `${i * 0.04}s` }}>
                  <XCircle size={10} />
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Extracted AI Data ─────────────────────────────────── */}
      <div className="glass-card p-5">
        <h4 className="font-display font-600 text-ink-100 text-sm mb-4">AI Extracted Overview</h4>
        <div className="space-y-4">
          <div>
            <p className="text-volt-400 text-xs mb-1 font-mono uppercase">Experience</p>
            <p className="text-ink-300 text-sm leading-relaxed">{data.experience || 'No experience extracted.'}</p>
          </div>
          <div className="h-px bg-ink-800/60 w-full" />
          <div>
            <p className="text-volt-400 text-xs mb-1 font-mono uppercase">Education</p>
            <p className="text-ink-300 text-sm leading-relaxed">{data.education || 'No education extracted.'}</p>
          </div>
          <div className="h-px bg-ink-800/60 w-full" />
          <div>
            <p className="text-volt-400 text-xs mb-2 font-mono uppercase">Projects</p>
            {data.projects && data.projects.length > 0 ? (
              <ul className="space-y-1 text-ink-300 text-sm leading-relaxed">
                {data.projects.map((proj, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-volt-400 font-mono mt-0.5">→</span>
                    {proj}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-300 text-sm leading-relaxed">No projects extracted.</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Suggestions ─────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={15} className="text-amber-400" />
          <h4 className="font-display font-600 text-ink-100 text-sm">Improvement Suggestions</h4>
        </div>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i}
              className="flex gap-3 p-3 rounded-xl bg-ink-800/60 border border-ink-700/50 animate-fade-up"
              style={{ animationDelay: `${i * 0.06}s` }}>
              <div className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 font-mono text-xs font-700">{i + 1}</span>
              </div>
              <p className="text-ink-300 text-sm leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Stat card sub-component
function StatCard({ icon, value, label, color }) {
  const borders = { volt: 'border-volt-400/10', red: 'border-red-400/10', blue: 'border-blue-400/10', amber: 'border-amber-400/10' }
  const bgs     = { volt: 'bg-volt-400/5',     red: 'bg-red-400/5',     blue: 'bg-blue-400/5',     amber: 'bg-amber-400/5'     }
  return (
    <div className={`glass-card p-4 ${bgs[color]} ${borders[color]}`}>
      <div className="flex items-start justify-between">
        {icon}
      </div>
      <p className="font-display font-800 text-2xl text-ink-50 mt-2">{value}</p>
      <p className="text-ink-500 text-xs mt-0.5">{label}</p>
    </div>
  )
}
