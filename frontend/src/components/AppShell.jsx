import { Link, useLocation } from 'react-router-dom'
import { BriefcaseBusiness, FileSearch, FolderGit2, History, LayoutDashboard, LayoutTemplate, LogOut, Menu, Settings, Sparkles, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const items = [
  ['Workspace', '/dashboard', LayoutDashboard], ['Analyze resume', '/dashboard', FileSearch], ['Analysis history', '/dashboard#history', History],
  ['Career profile', '/workspace/profile', UserRound], ['Resume builder', '/workspace/builder', LayoutTemplate], ['GitHub evidence', '/workspace/github', FolderGit2], ['Optimization studio', '/workspace/optimize', Sparkles], ['Applications', '/workspace/applications', BriefcaseBusiness], ['Settings', '/workspace/settings', Settings],
]
export default function AppShell({ children }) {
  const [open, setOpen] = useState(false); const location = useLocation(); const { user, logout } = useAuth()
  const close = () => setOpen(false)
  const nav = <nav id="workspace-navigation" className="app-nav" aria-label="Workspace">{items.map(([label, to, Icon], index) => {
    const isPreview = index > 2
    const active = (label === 'Analyze resume' && location.pathname === '/dashboard' && location.hash !== '#history') || (to === '/dashboard#history' && location.pathname === '/dashboard' && location.hash === '#history') || (isPreview && location.pathname === to)
    return <Link key={label} onClick={close} className={active ? 'nav-active' : ''} to={to}><Icon size={17} aria-hidden="true" /><span>{label}</span>{isPreview && <small>Preview</small>}</Link>
  })}</nav>
  const name = user?.name || 'Account'
  return <div className="app-shell"><aside className={open ? 'sidebar sidebar-open' : 'sidebar'}><Link to="/" className="brand" onClick={close}><span>IQ</span> ResumeIQ</Link>{nav}<p className="sidebar-note">Your documents stay private and are available only through your account.</p></aside><div className="workspace"><header className="workspace-top"><button type="button" className="mobile-menu" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="workspace-navigation">{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button><p>Career workspace</p><div className="workspace-account"><span title={user?.email || name}>{name}</span><button type="button" onClick={logout} className="workspace-signout"><LogOut size={14} aria-hidden="true" /> <span>Sign out</span></button><Link to="/" className="back-link">Public site</Link></div></header>{children}</div></div>
}
