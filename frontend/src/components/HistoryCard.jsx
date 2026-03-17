// components/HistoryCard.jsx

import { FileText, ChevronRight, Trash2 } from 'lucide-react'
import api from '../utils/api'
import { useState } from 'react'

export default function HistoryCard({ analysis, onDelete, onSelect }) {
  const [deleting, setDeleting] = useState(false)

  const getScoreStyle = (s) => {
    if (s >= 75) return 'text-volt-400 bg-volt-400/10'
    if (s >= 50) return 'text-amber-400 bg-amber-400/10'
    if (s >= 30) return 'text-orange-400 bg-orange-400/10'
    return 'text-red-400 bg-red-400/10'
  }

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm('Delete this analysis?')) return
    setDeleting(true)
    try {
      await api.delete(`/history/${analysis._id}`)
      onDelete(analysis._id)
    } catch {
      alert('Failed to delete.')
      setDeleting(false)
    }
  }

  return (
    <div onClick={() => onSelect(analysis)}
      className="glass-card p-4 cursor-pointer hover:border-ink-600 transition-all duration-200 group animate-fade-up">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-ink-800 flex items-center justify-center flex-shrink-0">
          <FileText size={15} className="text-ink-400 group-hover:text-ink-300 transition-colors" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-ink-200 text-sm font-medium truncate group-hover:text-ink-100 transition-colors">
            {analysis.jobTitle || 'Position Analysis'}
          </p>
          <p className="text-ink-600 text-xs mt-0.5">{formatDate(analysis.createdAt)}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`font-display font-700 text-sm px-2.5 py-1 rounded-lg ${getScoreStyle(analysis.score)}`}>
            {analysis.score}
          </span>
          <button onClick={handleDelete} disabled={deleting}
            className="w-7 h-7 rounded-lg hover:bg-red-950/40 flex items-center justify-center text-ink-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
            <Trash2 size={13} />
          </button>
          <ChevronRight size={14} className="text-ink-600 group-hover:text-ink-400 transition-colors" />
        </div>
      </div>
    </div>
  )
}
