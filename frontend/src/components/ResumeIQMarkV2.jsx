import { Link } from 'react-router-dom'

export default function ResumeIQMarkV2({ to, compact = false, tone = 'dark' }) {
  const mark = <span className={`riq-v2-logo riq-v2-logo--${tone}`}><svg viewBox="0 0 36 36" aria-hidden="true"><path d="M8 4.5h14.5L28 10v21.5H8z" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round"/><path d="M22 4.5V10h6M12.5 16.5h11M12.5 21h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="22.5" cy="25" r="4.25" fill="var(--riq-accent)"/><path d="m20.7 25 1.25 1.3 2.6-2.8" fill="none" stroke="#fff" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round"/></svg>{!compact && <span>ResumeIQ</span>}</span>
  return to ? <Link to={to} aria-label="ResumeIQ home">{mark}</Link> : mark
}
