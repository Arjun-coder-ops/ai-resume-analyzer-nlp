// components/ScoreRing.jsx - Interior Design System Circular Score Gauge

import { useEffect, useState } from 'react'
import { Badge } from './ui/Badge'
import { getScoreTier } from '../utils/scoring'

export default function ScoreRing({ score = 0, matchLevel = null }) {
  // Validate and clamp score safely to 0..100
  const safeScore = Math.min(100, Math.max(0, Math.round(Number(score) || 0)))
  const [displayScore, setDisplayScore] = useState(0)
  const [animated, setAnimated] = useState(false)

  // Circle radius and circumference (r = 46)
  const RADIUS = 46
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const offset = CIRCUMFERENCE - (safeScore / 100) * CIRCUMFERENCE
  const { stroke, label, variant } = getScoreTier(safeScore, matchLevel)

  useEffect(() => {
    setAnimated(false)
    setDisplayScore(0)

    const timer = setTimeout(() => {
      setAnimated(true)
      const duration = 1200
      const startTime = performance.now()

      const step = (now) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Smooth ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3)
        setDisplayScore(Math.round(eased * safeScore))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, 100)

    return () => clearTimeout(timer)
  }, [safeScore])

  return (
    <div
      role="progressbar"
      aria-valuenow={safeScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Overall resume ATS match score: ${safeScore} out of 100 (${label})`}
      className="flex flex-col items-center gap-3 select-none"
    >
      {/* Circular Gauge */}
      <div className="relative">
        <svg
          width="160"
          height="160"
          viewBox="0 0 110 110"
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Subtle track background */}
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            fill="none"
            stroke="oklch(0.9232 0.0026 48.72)"
            strokeWidth="7"
          />
          {/* Animated score arc */}
          <circle
            cx="55"
            cy="55"
            r={RADIUS}
            fill="none"
            stroke={stroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={animated ? offset : CIRCUMFERENCE}
            style={{
              transition: 'stroke-dashoffset 1.2s cubic-bezier(0.165, 0.84, 0.44, 1) 0.1s',
            }}
          />
        </svg>

        {/* Numeric score center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-sans font-bold text-4xl text-foreground leading-none tracking-tight tabular-nums">
            {displayScore}
          </span>
          <span className="text-[10px] font-mono font-medium text-muted-foreground mt-1 tracking-wider uppercase">
            Out of 100
          </span>
        </div>
      </div>

      {/* Semantic Status Badge */}
      <div className="text-center">
        <Badge variant={variant} className="text-xs px-2.5 py-0.5 font-medium">
          {label}
        </Badge>
        <p className="text-[11px] text-muted-foreground font-mono mt-1">
          Compatibility index
        </p>
      </div>
    </div>
  )
}
