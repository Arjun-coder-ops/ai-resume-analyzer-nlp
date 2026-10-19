// utils/scoring.js - Unified ATS scoring thresholds & tier helpers

/**
 * Authoritative ATS scoring thresholds shared across backend and frontend
 */
export const SCORE_THRESHOLDS = {
  EXCEPTIONAL: 85,
  STRONG: 70,
  GOOD: 50,
}

/**
 * Get standard match level string based on score
 */
export function getMatchLevel(score) {
  const num = Math.round(Number(score) || 0)
  if (num >= SCORE_THRESHOLDS.EXCEPTIONAL) return 'Exceptional Match'
  if (num >= SCORE_THRESHOLDS.STRONG) return 'Strong Match'
  if (num >= SCORE_THRESHOLDS.GOOD) return 'Good Match'
  return 'Needs Optimization'
}

/**
 * Get semantic badge/token variant based on score
 */
export function getScoreVariant(score) {
  const num = Math.round(Number(score) || 0)
  if (num >= SCORE_THRESHOLDS.EXCEPTIONAL) return 'success'
  if (num >= SCORE_THRESHOLDS.STRONG) return 'accent'
  if (num >= SCORE_THRESHOLDS.GOOD) return 'warning'
  return 'destructive'
}

/**
 * Score tier helper matching Interior's restrained semantic palette
 */
export function getScoreTier(score, customMatchLevel) {
  const safeScore = Math.min(100, Math.max(0, Math.round(Number(score) || 0)))
  const label = customMatchLevel || getMatchLevel(safeScore)
  const variant = getScoreVariant(safeScore)

  let stroke = 'oklch(0.5563 0.1632 32)' // Destructive terracotta
  if (variant === 'success') {
    stroke = 'oklch(0.5262 0.0942 151.04)' // Success moss
  } else if (variant === 'accent') {
    stroke = 'oklch(0.5832 0.227 268.34)' // Restrained cobalt
  } else if (variant === 'warning') {
    stroke = 'oklch(0.6658 0.1574 58.32)' // Warm amber
  }

  return { stroke, label, variant }
}
