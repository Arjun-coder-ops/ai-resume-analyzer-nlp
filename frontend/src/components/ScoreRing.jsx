// components/ScoreRing.jsx - Animated circular ATS score gauge with dynamic tiers
import { useEffect, useState } from 'react'

const getScoreTier = (score, customMatchLevel) => {
  if (customMatchLevel) {
    if (score >= 85) return { stroke: '#a0f000', text: 'text-volt-400', label: customMatchLevel, labelColor: 'text-volt-400', glow: 'rgba(160, 240, 0, 0.25)' }
    if (score >= 70) return { stroke: '#38bdf8', text: 'text-sky-400',  label: customMatchLevel, labelColor: 'text-sky-400',  glow: 'rgba(56, 189, 248, 0.25)' }
    if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-400', label: customMatchLevel, labelColor: 'text-amber-400', glow: 'rgba(245, 158, 11, 0.25)' }
    return { stroke: '#ef4444', text: 'text-red-400', label: customMatchLevel, labelColor: 'text-red-400', glow: 'rgba(239, 68, 68, 0.25)' }
  }

  if (score >= 85) return { stroke: '#a0f000', text: 'text-volt-400', label: 'Exceptional Match', labelColor: 'text-volt-400', glow: 'rgba(160, 240, 0, 0.25)' }
  if (score >= 70) return { stroke: '#38bdf8', text: 'text-sky-400',  label: 'Strong Match',      labelColor: 'text-sky-400',  glow: 'rgba(56, 189, 248, 0.25)' }
  if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'Good Match',        labelColor: 'text-amber-400', glow: 'rgba(245, 158, 11, 0.25)' }
  if (score >= 35) return { stroke: '#fb923c', text: 'text-orange-400', label: 'Fair Match',        labelColor: 'text-orange-400', glow: 'rgba(251, 146, 60, 0.25)' }
  return { stroke: '#ef4444', text: 'text-red-400', label: 'Needs Optimization', labelColor: 'text-red-400', glow: 'rgba(239, 68, 68, 0.25)' }
}

export default function ScoreRing({ score = 0, matchLevel = null }) {
  const safeScore = Math.min(100, Math.max(0, Math.round(Number(score) || 0)))
  const [displayScore, setDisplayScore] = useState(0)
  const [animated, setAnimated] = useState(false)

  // Circumference of circle r=46: 2 * π * 46 ≈ 289
  const RADIUS = 46
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const offset = CIRCUMFERENCE - (safeScore / 100) * CIRCUMFERENCE
  const { stroke, text, label, labelColor, glow } = getScoreTier(safeScore, matchLevel)

  useEffect(() => {
    setAnimated(false)
    setDisplayScore(0)
    const delay = setTimeout(() => {
      setAnimated(true)
      const duration = 1400
      const startTime = performance.now()
      const step = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setDisplayScore(Math.round(eased * safeScore))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 150)
    return () => clearTimeout(delay)
  }, [safeScore])

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Ring */}
      <div className="relative group">
        <svg width="170" height="170" viewBox="0 0 110 110" className="-rotate-90 drop-shadow-lg">
          {/* Track background */}
          <circle
            cx="55" cy="55" r={RADIUS} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            cx="55" cy="55" r={RADIUS} fill="none"
            stroke={stroke} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animated ? offset : CIRCUMFERENCE}
            style={{
              transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) 0.15s',
              filter: `drop-shadow(0 0 8px ${glow})`
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`font-display font-800 text-4xl leading-none tracking-tight ${text}`}>
            {displayScore}
          </span>
          <span className="text-ink-500 text-[11px] font-mono mt-1 font-semibold tracking-wider">
            OUT OF 100
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <span className={`inline-block font-display font-700 text-sm px-3 py-1 rounded-full bg-ink-800/80 border border-ink-700/60 ${labelColor}`}>
          {label}
        </span>
        <p className="text-ink-500 text-xs mt-1.5 font-medium tracking-wide">Industry ATS Score</p>
      </div>
    </div>
  )
}
