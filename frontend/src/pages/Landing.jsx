import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, FileSearch, Sparkles, Target } from 'lucide-react'

const steps = [
  ['Bring your resume', 'Upload the PDF you already use.'],
  ['Add the opportunity', 'Paste a job description for a focused review.'],
  ['Work from evidence', 'See gaps, score drivers, and grounded next steps.'],
]

export default function Landing() {
  return <main className="marketing-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <nav className="marketing-nav" aria-label="Primary navigation">
      <Link className="brand" to="/"><span>IQ</span> ResumeIQ</Link>
      <div className="nav-links"><a href="#how">How it works</a><a href="#principles">Principles</a><Link to="/login">Sign in</Link></div>
      <Link className="button-primary" to="/register">Create free account <ArrowRight size={16}/></Link>
    </nav>
    <section id="main-content" className="hero-section">
      <p className="eyebrow">A calmer way to prepare</p>
      <h1>Bring clarity to<br/>your next application.</h1>
      <p className="hero-copy">ResumeIQ compares your documented experience with a role, explains the score, and keeps your original resume private.</p>
      <div className="hero-actions"><Link className="button-primary button-large" to="/register">Analyze a resume <ArrowRight size={18}/></Link><Link className="text-link" to="/login">I already have an account</Link></div>
      <div className="product-window" aria-label="ResumeIQ product preview">
        <div className="preview-rail"><span>Resume review</span><span>Role match</span><span>Recommendations</span></div>
        <div className="preview-content"><div><p className="caption">Target role</p><h2>Product designer</h2><p>Experience aligned to research, systems, and delivery.</p></div><div className="score-orb">82<small>match</small></div><div className="preview-list"><p><CheckCircle2/> Research practice documented</p><p><CheckCircle2/> Design systems experience found</p><p><Target/> 2 areas to strengthen</p></div></div>
      </div>
    </section>
    <section id="principles" className="tagline-reveal"><p>Make every application<br/>a more informed decision.</p></section>
    <section id="how" className="steps-section"><p className="eyebrow">The review loop</p><h2>Focused inputs. Useful evidence.</h2><div className="steps-grid">{steps.map(([title,copy], i)=><article key={title}><span>0{i+1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="principles-grid"><article><FileSearch/><h3>Private by default</h3><p>Your resume is available only through authenticated document access.</p></article><article><Sparkles/><h3>Explainable signals</h3><p>Each score is broken into skills, experience, education, impact, and format.</p></article><article><Target/><h3>Specific next steps</h3><p>Recommendations distinguish documented evidence from opportunities to improve.</p></article></section>
    <footer><span>ResumeIQ</span><span>Open source career tooling</span><span>Privacy · Terms</span></footer>
  </main>
}
