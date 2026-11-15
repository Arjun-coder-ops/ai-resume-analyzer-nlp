import { useState } from 'react'
import { Download, FileText, LoaderCircle, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from './ui/Badge'
import api from '../utils/api'

const statusCopy = { completed: 'Ready to review', failed: 'Needs attention', queued: 'Queued', pending: 'Queued', processing: 'In progress' }
const scoreVariant = (score) => score >= 80 ? 'success' : score >= 65 ? 'accent' : score >= 50 ? 'warning' : 'destructive'
function formatDate(value) { try { return value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : 'Recent' } catch { return 'Recent' } }

export default function HistoryCard({ analysis, onDelete, onSelect }) {
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [actionError, setActionError] = useState('')
  const score = Math.round(Number(analysis.score) || 0)
  const isCompleted = analysis.status === 'completed'

  const handleDownload = async (event) => {
    event.stopPropagation()
    try {
      const response = await api.get(`/history/${analysis._id}/resume`, { responseType: 'blob' })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = analysis.resumeOriginalName || 'resume.pdf'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch { setActionError('Your private document could not be downloaded. Please try again.') }
  }
  const handleDelete = async (event) => {
    event.stopPropagation()
    if (!confirmingDelete) { setActionError(''); setConfirmingDelete(true); return }
    setDeleting(true); setActionError('')
    try { await api.delete(`/history/${analysis._id}`); onDelete(analysis._id) }
    catch { setActionError('We could not delete this analysis. Your document is still retained privately.'); setDeleting(false); setConfirmingDelete(false) }
  }

  return <article className="history-card" aria-label={`${analysis.jobTitle || 'Position'} analysis`}>
    <button type="button" className="history-card-main" onClick={() => onSelect(analysis)}>
      <span className="history-card-icon" aria-hidden="true"><FileText size={18} /></span>
      <span className="history-card-copy"><span className="history-card-title">{analysis.jobTitle || 'Position analysis'}</span><span className="history-card-meta">{formatDate(analysis.createdAt)}{analysis.resumeOriginalName ? ` · ${analysis.resumeOriginalName}` : ''}</span></span>
      <span className="history-card-status">{isCompleted ? <Badge variant={scoreVariant(score)} className="font-mono tabular-nums">{score}<span className="sr-only"> out of 100</span></Badge> : <Badge variant={analysis.status === 'failed' ? 'destructive' : 'secondary'}>{statusCopy[analysis.status] || 'Saved'}</Badge>}<span className="history-card-open">Open <span aria-hidden="true">→</span></span></span>
    </button>
    <div className="history-card-actions" aria-label="Analysis actions">
      {isCompleted && <button type="button" className="history-action" onClick={handleDownload} aria-label={`Download private copy of ${analysis.resumeOriginalName || 'resume'}`}><Download size={15} aria-hidden="true" /> <span>Download</span></button>}
      {confirmingDelete ? <div className="history-delete-confirm" role="group" aria-label="Confirm deletion"><span>Delete analysis and private file?</span><button type="button" className="history-delete-yes" onClick={handleDelete} disabled={deleting}>{deleting ? <LoaderCircle className="animate-spin" size={14} /> : <Trash2 size={14} />} {deleting ? 'Deleting' : 'Delete'}</button><button type="button" className="history-action" onClick={() => setConfirmingDelete(false)}>Keep</button></div> : <button type="button" className="history-action history-action-danger" onClick={handleDelete} aria-label={`Delete ${analysis.jobTitle || 'analysis'}`}><Trash2 size={15} aria-hidden="true" /> <span>Delete</span></button>}
    </div>
    {actionError && <p className="history-card-error" role="alert">{actionError}</p>}
    {!isCompleted && analysis.status !== 'failed' && <p className="history-card-progress"><RotateCcw size={13} aria-hidden="true" /> Select this item to resume live status updates.</p>}
  </article>
}
