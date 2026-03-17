// components/Navbar.jsx

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Zap, LogOut, User, ChevronDown } from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-ink-800/60 bg-ink-900/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-volt-400 flex items-center justify-center">
            <Zap size={14} className="text-ink-900" fill="currentColor" />
          </div>
          <span className="font-display font-700 text-base text-ink-100 tracking-tight">ResumeIQ</span>
        </div>

        {/* User menu */}
        <div className="relative">
          <button onClick={() => setOpen(v => !v)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-ink-700 hover:border-ink-600 transition-colors bg-ink-800/50">
            <div className="w-6 h-6 rounded-full bg-volt-400/20 border border-volt-400/30 flex items-center justify-center">
              <User size={12} className="text-volt-400" />
            </div>
            <span className="text-ink-200 text-sm font-medium hidden sm:block max-w-32 truncate">{user?.name}</span>
            <ChevronDown size={13} className={`text-ink-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-48 glass-card shadow-glass z-20 p-1 animate-scale-in">
                <div className="px-3 py-2 border-b border-ink-700/60 mb-1">
                  <p className="text-ink-300 text-xs font-medium truncate">{user?.email}</p>
                </div>
                <button onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-300 hover:text-red-400 hover:bg-red-950/30 transition-colors">
                  <LogOut size={14} />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
