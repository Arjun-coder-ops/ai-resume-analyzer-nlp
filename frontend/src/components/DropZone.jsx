// components/DropZone.jsx - Interior Design System Drag & Drop PDF Uploader

import { useState, useRef, useCallback } from 'react'
import { Upload, FileText, X, CircleAlert } from 'lucide-react'
import { Badge } from './ui/Badge'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB (conforms to backend Multer limit)

export default function DropZone({ file, onFileChange }) {
  const [dragging, setDragging] = useState(false)
  const [dropError, setDropError] = useState('')
  const inputRef = useRef(null)

  const validateAndSelect = useCallback(
    (selectedFile) => {
      setDropError('')
      if (!selectedFile) return

      // Strict PDF MIME and extension check matching backend uploadMiddleware
      const isPdfMime = selectedFile.type === 'application/pdf'
      const isPdfExt = selectedFile.name.toLowerCase().endsWith('.pdf')

      if (!isPdfMime && !isPdfExt) {
        setDropError('Only PDF documents are supported. Please select a .pdf file.')
        return
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setDropError('File size exceeds the 10 MB limit. Please select a smaller PDF.')
        return
      }

      if (selectedFile.size === 0) {
        setDropError('The selected file appears to be empty.')
        return
      }

      onFileChange(selectedFile)
    },
    [onFileChange]
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setDragging(false)
      const droppedFile = e.dataTransfer?.files?.[0]
      if (droppedFile) {
        validateAndSelect(droppedFile)
      }
    },
    [validateAndSelect]
  )

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      inputRef.current?.click()
    }
  }

  const formatFileSize = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="space-y-2">
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) validateAndSelect(picked)
          // Reset value so the user can select the same file again if desired
          e.target.value = ''
        }}
      />

      {file ? (
        /* ── Selected File State: Lifted Card ─────────────── */
        <div className="rounded-card border border-border/90 bg-card p-3.5 shadow-lift flex items-center justify-between gap-3 animate-scale-in">
          <div className="flex items-center gap-3 min-w-0">
            {/* Square avatar/tile for document icon */}
            <div className="w-9 h-9 rounded-[0.3125rem] bg-secondary border border-border flex items-center justify-center shrink-0 shadow-well">
              <FileText size={18} className="text-foreground" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate max-w-[16rem] sm:max-w-xs">
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">
                  {formatFileSize(file.size)}
                </span>
                <Badge variant="secondary" className="text-[0.625rem] font-mono py-0">
                  PDF
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-badge hover:bg-secondary transition-colors"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setDropError('')
                onFileChange(null)
              }}
              aria-label="Remove uploaded resume"
              className="w-7 h-7 rounded-badge flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        /* ── Drop Area: Recessed Well ─────────────────────── */
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={handleKeyDown}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative rounded-card border-2 border-dashed p-6 text-center cursor-pointer select-none
            transition-all duration-150 outline-none
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent
            ${
              dragging
                ? 'border-primary bg-secondary shadow-well scale-[0.99]'
                : 'border-border/90 bg-secondary/40 hover:bg-secondary/70 hover:border-border'
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className={`w-10 h-10 rounded-[0.375rem] border border-border flex items-center justify-center shadow-well transition-colors ${
                dragging ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
              }`}
            >
              <Upload size={18} aria-hidden="true" />
            </div>

            <div>
              <p className="text-sm font-medium text-foreground">
                {dragging ? 'Drop PDF to upload' : 'Upload your resume PDF'}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-normal">
                Drag and drop or <span className="text-foreground underline underline-offset-2 font-medium">browse files</span>
              </p>
            </div>

            <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground font-mono mt-1">
              <span>PDF format only</span>
              <span>·</span>
              <span>Up to 10 MB</span>
            </div>
          </div>
        </div>
      )}

      {/* Inline validation error if user dropped an invalid file */}
      {dropError && (
        <div
          role="alert"
          aria-live="polite"
          className="p-2.5 rounded-badge bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 animate-scale-in"
        >
          <CircleAlert size={14} className="shrink-0" aria-hidden="true" />
          <span>{dropError}</span>
        </div>
      )}
    </div>
  )
}
