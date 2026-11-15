export default function BrandMark({ compact = false, className = '' }) {
  return <span className={`brand-lockup ${className}`} aria-label="ResumeIQ">
    <svg className="brand-symbol" viewBox="0 0 48 48" role="img" aria-hidden="true">
      <path d="M8 12.5 24 5l16 7.5v23L24 43 8 35.5z" fill="currentColor" />
      <path d="M17 16.5h14v3H17zm0 6h14v3H17zm0 6h8v3h-8z" fill="var(--brand-cutout)" />
      <path d="m29 29 3 3 6-7" fill="none" stroke="var(--brand-cutout)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {!compact && <span className="brand-wordmark">ResumeIQ</span>}
  </span>
}
