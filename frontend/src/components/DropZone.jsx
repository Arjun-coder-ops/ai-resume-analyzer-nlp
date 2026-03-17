// components/DropZone.jsx - Drag & Drop PDF uploader

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react'

export default function DropZone({ file, onFileChange }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    if (f.type !== 'application/pdf') {
      alert('Please upload a PDF file.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      alert('File size must be under 10 MB.')
      return
    }
    onFileChange(f)
  }, [onFileChange])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      {file ? (
        /* ── File selected state ──────────────────────── */
        <div className="glass-card p-4 flex items-center gap-4 border-volt-400/20 animate-scale-in">
          <div className="w-10 h-10 rounded-xl bg-volt-400/10 border border-volt-400/20 flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-volt-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ink-100 text-sm font-medium truncate">{file.name}</p>
            <p className="text-ink-500 text-xs mt-0.5">{formatSize(file.size)} · PDF</p>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-volt-400" />
            <button onClick={() => onFileChange(null)}
              className="w-7 h-7 rounded-lg hover:bg-ink-700 flex items-center justify-center text-ink-500 hover:text-ink-300 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        /* ── Drop area ────────────────────────────────── */
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200
            ${dragging
              ? 'border-volt-400 bg-volt-400/5 shadow-volt-sm scale-[1.01]'
              : 'border-ink-700 hover:border-ink-500 hover:bg-ink-800/30'
            }
          `}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />

          <div className={`w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all
            ${dragging ? 'bg-volt-400/20 scale-110' : 'bg-ink-800'}`}>
            <Upload size={22} className={dragging ? 'text-volt-400' : 'text-ink-400'} />
          </div>

          <p className={`font-medium text-sm transition-colors ${dragging ? 'text-volt-300' : 'text-ink-200'}`}>
            {dragging ? 'Drop your PDF here' : 'Drag & drop your resume'}
          </p>
          <p className="text-ink-500 text-xs mt-1.5">
            or <span className="text-volt-400 hover:underline">browse files</span> · PDF up to 10 MB
          </p>

          {/* Animated border when dragging */}
          {dragging && (
            <div className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ boxShadow: '0 0 0 1px rgba(160,240,0,0.4), 0 0 20px rgba(160,240,0,0.1)' }} />
          )}
        </div>
      )}
    </div>
  )
}
