// components/ScoreRing.jsx - Animated circular ATS score display

import { useEffect, useState } from 'react'

const getScoreColor = (score) => {
  if (score >= 75) return { stroke: '#a0f000', text: 'text-volt-400', label: 'Excellent', labelColor: 'text-volt-400' }
  if (score >= 50) return { stroke: '#f59e0b', text: 'text-amber-400', label: 'Good',      labelColor: 'text-amber-400' }
  if (score >= 30) return { stroke: '#f97316', text: 'text-orange-400', label: 'Fair',     labelColor: 'text-orange-400' }
  return                    { stroke: '#ef4444', text: 'text-red-400',   label: 'Poor',     labelColor: 'text-red-400'   }
}

export default function ScoreRing({ score }) {
  const [displayScore, setDisplayScore] = useState(0)
  const [animated, setAnimated] = useState(false)

  // Circumference of circle r=45: 2 * π * 45 ≈ 282.7
  const CIRCUMFERENCE = 282.7
  const offset = CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE
  const { stroke, text, label, labelColor } = getScoreColor(score)

  // Count-up animation
  useEffect(() => {
    setAnimated(false)
    setDisplayScore(0)
    const delay = setTimeout(() => {
      setAnimated(true)
      let start = 0
      const duration = 1400
      const startTime = performance.now()
      const step = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
        setDisplayScore(Math.round(eased * score))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 200)
    return () => clearTimeout(delay)
  }, [score])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring */}
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 100 100" className="-rotate-90">
          {/* Track */}
          <circle cx="50" cy="50" r="45" fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth="7" />
          {/* Progress arc */}
          <circle cx="50" cy="50" r="45" fill="none"
            stroke={stroke} strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animated ? offset : CIRCUMFERENCE}
            style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1) 0.2s' }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display font-800 text-4xl leading-none ${text}`}>
            {displayScore}
          </span>
          <span className="text-ink-500 text-xs mt-1 font-mono">/ 100</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <span className={`font-display font-700 text-sm ${labelColor}`}>{label} Match</span>
        <p className="text-ink-500 text-xs mt-0.5">ATS Compatibility Score</p>
      </div>

      {/* Score bar breakdown */}
      <div className="w-full bg-ink-800 rounded-full h-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 delay-300"
          style={{ width: animated ? `${score}%` : '0%', backgroundColor: stroke }} />
      </div>
    </div>
  )
}
