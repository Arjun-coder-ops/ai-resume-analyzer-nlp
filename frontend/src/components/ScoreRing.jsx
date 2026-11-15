import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { Badge } from './ui/Badge'
import { getScoreTier } from '../utils/scoring'

const RADIUS = 46
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ScoreRing({ score = 0, matchLevel = null }) {
  const root = useRef(null)
  const arc = useRef(null)
  const [displayScore, setDisplayScore] = useState(0)
  const safeScore = Math.min(100, Math.max(0, Math.round(Number(score) || 0)))
  const offset = CIRCUMFERENCE - (safeScore / 100) * CIRCUMFERENCE
  const { stroke, label, variant } = getScoreTier(safeScore, matchLevel)

  useGSAP(() => {
    const media = gsap.matchMedia()
    const reset = () => {
      setDisplayScore(0)
      gsap.set(arc.current, { attr: { strokeDashoffset: CIRCUMFERENCE } })
    }

    media.add('(prefers-reduced-motion: no-preference)', () => {
      reset()
      const counter = { value: 0 }
      const sequence = gsap.timeline({ defaults: { ease: 'power3.out' } })
      sequence.to(counter, {
        value: safeScore,
        duration: 1.05,
        onUpdate: () => setDisplayScore(Math.round(counter.value)),
      }, 0).to(arc.current, { attr: { strokeDashoffset: offset }, duration: 1.05 }, 0)
    })

    media.add('(prefers-reduced-motion: reduce)', () => {
      setDisplayScore(safeScore)
      gsap.set(arc.current, { attr: { strokeDashoffset: offset } })
    })

    return () => media.revert()
  }, { scope: root, dependencies: [safeScore, offset] })

  return (
    <div ref={root} role="progressbar" aria-valuenow={safeScore} aria-valuemin={0} aria-valuemax={100} aria-label={`Overall resume ATS match score: ${safeScore} out of 100 (${label})`} className="score-ring">
      <div className="score-ring__graphic">
        <svg width="160" height="160" viewBox="0 0 110 110" className="-rotate-90" aria-hidden="true">
          <circle cx="55" cy="55" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="7" />
          <circle ref={arc} cx="55" cy="55" r={RADIUS} fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={CIRCUMFERENCE} />
        </svg>
        <div className="score-ring__value" aria-hidden="true"><strong>{displayScore}</strong><span>out of 100</span></div>
      </div>
      <div className="score-ring__caption">
        <Badge variant={variant}>{label}</Badge>
        <p>Compatibility index</p>
      </div>
    </div>
  )
}
