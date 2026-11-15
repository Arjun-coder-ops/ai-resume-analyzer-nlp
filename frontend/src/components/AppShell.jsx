import { Link, useLocation } from 'react-router-dom'
import { BriefcaseBusiness, FileSearch, FolderGit2, History, LayoutTemplate, LogOut, Menu, Settings, Sparkles, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const currentItems = [
  ['Analyze', '/dashboard', FileSearch],
  ['History', '/dashboard#history', History],
]

const previewItems = [
  ['Career profile', '/workspace/profile', UserRound],
  ['Resume builder', '/workspace/builder', LayoutTemplate],
  ['GitHub evidence', '/workspace/github', FolderGit2],
  ['Optimization', '/workspace/optimize', Sparkles],
  ['Applications', '/workspace/applications', BriefcaseBusiness],
  ['Settings', '/workspace/settings', Settings],
]

function WorkspaceLink({ item, isPreview, close }) {
  const [label, to, Icon] = item
  const location = useLocation()
  const active = (to === '/dashboard' && location.pathname === '/dashboard' && location.hash !== '#history') || (to === '/dashboard#history' && location.pathname === '/dashboard' && location.hash === '#history') || (isPreview && location.pathname === to)

  return (
    <Link to={to} className={active ? 'workbench-link workbench-link--active' : 'workbench-link'} onClick={close}>
      <Icon size={16} aria-hidden="true" />
      <span>{label}</span>
      {isPreview && <small>Planned</small>}
    </Link>
  )
}

export default function AppShell({ children }) {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const close = () => setOpen(false)
  const name = user?.name || 'Account'

  return (
    <div className="workbench-shell">
      <header className="workbench-masthead">
        <Link to="/" className="workbench-brand" aria-label="ResumeIQ public site">
          <span aria-hidden="true">IQ</span> ResumeIQ
        </Link>
        <p className="workbench-masthead__label">Career intelligence workspace</p>
        <div className="workbench-masthead__account">
          <span title={user?.email || name}>{name}</span>
          <button type="button" onClick={logout} className="workbench-signout"><LogOut size={14} aria-hidden="true" /> Sign out</button>
        </div>
        <button type="button" className="workbench-menu" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close workspace navigation' : 'Open workspace navigation'} aria-expanded={open} aria-controls="workspace-navigation">
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <aside className={open ? 'workbench-rail workbench-rail--open' : 'workbench-rail'}>
        <nav id="workspace-navigation" aria-label="Workspace navigation">
          <p className="workbench-rail__label">Current workspace</p>
          <div className="workbench-links">{currentItems.map((item) => <WorkspaceLink key={item[0]} item={item} close={close} />)}</div>
          <p className="workbench-rail__label workbench-rail__label--later">Built next</p>
          <div className="workbench-links">{previewItems.map((item) => <WorkspaceLink key={item[0]} item={item} isPreview close={close} />)}</div>
        </nav>
        <p className="workbench-rail__note">Your documents and saved analyses remain private to this account.</p>
      </aside>

      <div className="workbench-canvas">{children}</div>
    </div>
  )
}
