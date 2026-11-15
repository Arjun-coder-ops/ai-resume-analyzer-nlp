import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BriefcaseBusiness, FolderGit2, LayoutTemplate, Settings, Sparkles, UserRound } from 'lucide-react'
import AppShell from '../components/AppShell'

const modules = {
  profile: { icon: UserRound, eyebrow: 'Career profile', title: 'Build the context behind your resume.', description: 'A structured career profile will make future analyses and resume drafts more specific. This workspace is being prepared and does not store profile information yet.', panels: ['Professional story', 'Skills evidence', 'Career preferences'] },
  builder: { icon: LayoutTemplate, eyebrow: 'Resume builder', title: 'Draft with the evidence you already own.', description: 'The builder is planned for a later milestone. Nothing you type here is collected yet, and no draft is being generated.', panels: ['Role-focused outline', 'Impact statements', 'Export-ready templates'] },
  github: { icon: FolderGit2, eyebrow: 'GitHub intelligence', title: 'Make technical work legible to hiring teams.', description: 'Repository evidence will be connected only after a later milestone. ResumeIQ is not connected to GitHub on this screen.', panels: ['Repository narrative', 'Contribution signals', 'Project evidence'] },
  optimize: { icon: Sparkles, eyebrow: 'Optimization studio', title: 'Improve with editorial control.', description: 'This future studio will compare approved changes with your original resume. It is a preview only; no AI rewrite is running.', panels: ['Before / after review', 'Keyword placement', 'Tone and clarity'] },
  applications: { icon: BriefcaseBusiness, eyebrow: 'Application tracker', title: 'Keep opportunity context together.', description: 'Application tracking is planned for a later milestone. This preview does not create or track applications.', panels: ['Target companies', 'Interview notes', 'Follow-up cadence'] },
  settings: { icon: Settings, eyebrow: 'Account & privacy', title: 'Your account controls, in one place.', description: 'Privacy controls remain enforced by the current authenticated API. Expanded account settings will arrive in a later milestone.', panels: ['Session and security', 'Document retention', 'Data preferences'] },
}
export default function FutureModule() {
  const { module } = useParams(); const item = modules[module] || modules.profile; const Icon = item.icon
  return <AppShell><main className="workspace-main future-module"><Link to="/dashboard" className="future-back"><ArrowLeft size={15} aria-hidden="true" /> Back to workspace</Link><section className="future-hero" aria-labelledby="future-title"><span className="future-icon"><Icon size={24} aria-hidden="true" /></span><p className="eyebrow">{item.eyebrow} · planned</p><h1 id="future-title">{item.title}</h1><p>{item.description}</p><span className="future-status">Preview surface — unavailable in this release</span></section><section className="future-grid" aria-label={`${item.eyebrow} planned capabilities`}>{item.panels.map((panel, index) => <article key={panel}><span>0{index + 1}</span><h2>{panel}</h2><p>Designed as a foundation for a future functional workflow.</p></article>)}</section></main></AppShell>
}
