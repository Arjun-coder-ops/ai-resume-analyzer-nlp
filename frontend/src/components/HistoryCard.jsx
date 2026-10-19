// components/HistoryCard.jsx - Interior Design System History Card

import { useState } from 'react'
import { FileText, ChevronRight, Trash2, Clock, Check } from 'lucide-react'
import { Badge } from './ui/Badge'
import api from '../utils/api'

export default function HistoryCard({ analysis, onDelete, onSelect }) {
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const score = Math.round(Number(analysis.score) || 0)
  const isCompleted = analysis.status === 'completed'
  const isFailed = analysis.status === 'failed'

  const getScoreVariant = (s) => {
    if (s >= 80) return 'success'
    if (s >= 65) return 'accent'
    if (s >= 50) return 'warning'
    return 'destructive'
  }

  const formatDate = (d) => {
    if (!d) return 'Recent'
    try {
      return new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return 'Recent'
    }
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }

    setDeleting(true)
    try {
      await api.delete(`/history/${analysis._id}`)
      onDelete(analysis._id)
    } catch {
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(analysis)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(analysis)}
      onKeyDown={handleKeyDown}
      className="rounded-card bg-card border border-border/80 p-4 shadow-lift hover:border-foreground/30 hover:shadow-md transition-all duration-150 cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Leading Document Icon in Square Avatar Tile */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-[0.3125rem] bg-secondary border border-border flex items-center justify-center shrink-0 shadow-well text-foreground">
            <FileText size={16} aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
              {analysis.jobTitle || 'Position Analysis'}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mt-0.5">
              <span>{formatDate(analysis.createdAt)}</span>
              {analysis.resumeOriginalName && (
                <>
                  <span>·</span>
                  <span className="truncate max-w-[12rem]">{analysis.resumeOriginalName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status, Score & Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Status or Score Badge */}
          {isCompleted ? (
            <Badge variant={getScoreVariant(score)} className="font-mono tabular-nums text-xs font-semibold px-2.5 py-1">
              {score} / 100
            </Badge>
          ) : isFailed ? (
            <Badge variant="destructive" className="text-xs">
              Failed
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Processing
            </Badge>
          )}

          {/* Delete Action with Inline Confirmation */}
          {confirmingDelete ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded-badge font-medium hover:opacity-90 transition-opacity"
              >
                {deleting ? 'Deleting…' : 'Delete?'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-xs text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-badge"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDelete}
              aria-label={`Delete analysis for ${analysis.jobTitle || 'position'}`}
              className="w-7 h-7 rounded-badge flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-destructive/30 outline-none"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          )}

          <ChevronRight size={15} className="text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}
