// components/Navbar.jsx - Interior Design System Navigation Header

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { LogOut, ChevronDown } from 'lucide-react'
import { Badge } from './ui/Badge'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Keyboard navigation and outside click management
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Derive candidate initials reliably from available name or email
  const getInitials = (name, email) => {
    if (name && typeof name === 'string' && name.trim()) {
      const parts = name.trim().split(/\s+/)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return parts[0].slice(0, 2).toUpperCase()
    }
    if (email && typeof email === 'string' && email.trim()) {
      return email.slice(0, 2).toUpperCase()
    }
    return 'IQ'
  }

  const initials = getInitials(user?.name, user?.email)

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-sm shadow-[0_1px_2px_oklch(0.2161_0.0061_56.04_/_0.03)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[0.375rem] bg-primary text-primary-foreground flex items-center justify-center shadow-cap select-none">
            <span className="font-sans font-bold text-xs tracking-tight">IQ</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-sans font-semibold text-base text-foreground tracking-tight">
              ResumeIQ
            </span>
            <Badge variant="secondary" className="hidden sm:inline-flex text-[0.6875rem] font-mono text-muted-foreground border-border/60">
              ATS Studio
            </Badge>
          </div>
        </div>

        {/* User Account Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label="User account menu"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-btn border border-border/80 bg-card hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shadow-row transition-all duration-150 select-none text-foreground"
          >
            {/* Square avatar tile conforming to Interior design guidelines with crisp contrast */}
            <div className="w-6 h-6 rounded-[0.3125rem] bg-secondary text-foreground font-mono text-[11px] font-bold flex items-center justify-center border border-border shrink-0">
              {initials}
            </div>
            <span className="text-foreground text-sm font-semibold hidden sm:block max-w-[9rem] truncate">
              {user?.name || 'Account'}
            </span>
            <ChevronDown
              size={13}
              className={`text-muted-foreground transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {/* Floating Dropdown Menu */}
          {open && (
            <div
              role="menu"
              aria-orientation="vertical"
              className="absolute right-0 top-full mt-1.5 w-60 rounded-card border border-border/90 bg-card p-1.5 shadow-float-dropdown z-50 animate-scale-in"
            >
              {/* User details summary block */}
              <div className="px-3 py-2.5 bg-secondary/60 rounded-badge mb-1 border border-border/40">
                <p className="text-foreground text-xs font-semibold truncate">
                  {user?.name || 'Signed In'}
                </p>
                <p className="text-muted-foreground text-[11px] font-mono truncate mt-0.5">
                  {user?.email || 'No email attached'}
                </p>
              </div>

              {/* Sign out action */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  logout()
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-badge text-sm text-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30 transition-colors duration-150 text-left group"
              >
                <LogOut size={14} className="shrink-0 text-muted-foreground group-hover:text-destructive transition-colors" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
