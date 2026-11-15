import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const revealWords = 'A useful career decision starts with evidence you can inspect.'.split(' ')

const steps = [
  ['01', 'Bring the source material', 'Upload the resume you already use and add the role description you want to understand.'],
  ['02', 'Read the relationship', 'ResumeIQ compares requirements with the skills and experience represented in your own document.'],
  ['03', 'Choose your next edit', 'Review the score, evidence, and recommendations before you change a line of your resume.'],
]

const faqs = [
  ['What does ResumeIQ analyze?', 'It analyzes the resume document and job description you submit, then presents the resulting compatibility information in your private workspace.'],
  ['Is my resume private?', 'Your documents are accessible only through your authenticated account. Downloads and deletion are protected by the same account controls.'],
  ['Can I use a PDF resume?', 'Yes. The analysis workspace accepts PDF resumes and shows file validation guidance before submission.'],
  ['Will ResumeIQ rewrite my resume for me?', 'The current product helps you inspect compatibility and recommendations. Future editing tools are clearly marked as planned until they are available.'],
  ['What happens after I submit an analysis?', 'The workspace keeps you informed while the analysis is processing, then shows the completed score and detailed findings when they are ready.'],
  ['Can I remove an analysis?', 'Yes. Each saved analysis has a protected deletion control in your history.'],
]

export default function Landing() {
  const root = useRef(null)

  useGSAP(() => {
    const media = gsap.matchMedia()

    media.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro
        .from('[data-hero-kicker]', { opacity: 0, y: 16, duration: .45 })
        .from('[data-hero-title]', { opacity: 0, y: 30, duration: .72 }, '-=.18')
        .from('[data-hero-copy], [data-hero-action]', { opacity: 0, y: 18, duration: .5, stagger: .1 }, '-=.35')
        .from('[data-theater]', { opacity: 0, y: 28, duration: .72 }, '-=.18')

      gsap.to('[data-tagline-word]', {
        color: '#1c2824',
        stagger: .09,
        duration: .42,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: '[data-tagline]',
          start: 'top 72%',
          once: true,
        },
      })

      gsap.utils.toArray('[data-reveal]').forEach((section) => {
        gsap.from(section, {
          opacity: 0,
          y: 28,
          duration: .7,
          ease: 'power3.out',
          scrollTrigger: { trigger: section, start: 'top 82%', once: true },
        })
      })
    })

    return () => media.revert()
  }, { scope: root })

  return (
    <main className="rebuild-site" ref={root}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="rebuild-nav" aria-label="Public navigation">
        <Link className="rebuild-brand" to="/">
          <span className="rebuild-brand-mark" aria-hidden="true">IQ</span>
          <span>ResumeIQ</span>
        </Link>
        <div className="rebuild-nav-actions">
          <Link to="/login">Sign in</Link>
          <Link className="rebuild-button" to="/register">Create account</Link>
        </div>
      </nav>

      <div id="main-content">
        <section className="rebuild-hero" aria-labelledby="hero-title">
          <p className="rebuild-kicker" data-hero-kicker>Resume intelligence for real applications</p>
          <h1 id="hero-title" data-hero-title>See what your resume is already saying.</h1>
          <p className="rebuild-hero-copy" data-hero-copy>
            ResumeIQ reads your resume alongside a target role and gives you an evidence based view of the match, the gaps, and the next edit worth making.
          </p>
          <div className="rebuild-hero-actions" data-hero-action>
            <Link className="rebuild-button" to="/register">Analyze a resume</Link>
            <Link className="rebuild-button rebuild-button--quiet" to="/login">Open workspace</Link>
          </div>
          <p className="rebuild-proof" data-hero-action>Private account access. PDF resume upload. No invented outcomes.</p>
        </section>

        <section className="evidence-theater" data-theater aria-label="Illustrative resume to role comparison">
          <div className="evidence-theater__topline">
            <span>Illustrative product preview</span>
            <span>Evidence review</span>
          </div>
          <div className="evidence-theater__body">
            <article className="evidence-source">
              <p className="rebuild-kicker">Your resume</p>
              <h2>Product designer</h2>
              <p>Signals present in the document are surfaced as evidence, not assumptions.</p>
              <ul className="evidence-list">
                <li><span>Research synthesis</span><small>evidence found</small></li>
                <li><span>Design systems</span><small>evidence found</small></li>
                <li><span>Product delivery</span><small>evidence found</small></li>
              </ul>
            </article>
            <div className="evidence-spine" aria-hidden="true"><span>compare</span><i>↔</i></div>
            <article className="evidence-source evidence-source--role">
              <p className="rebuild-kicker">Target role</p>
              <h2>Senior product designer</h2>
              <p>The role description gives context to each match and each missing requirement.</p>
              <ul className="evidence-list">
                <li><span>User research</span><small>aligned</small></li>
                <li><span>Design systems</span><small>aligned</small></li>
                <li><span>Experiment strategy</span><em>review needed</em></li>
              </ul>
            </article>
          </div>
        </section>

        <section className="rebuild-statement" data-tagline aria-label="ResumeIQ benefit">
          <p>{revealWords.map((word, index) => <span data-tagline-word key={`${word}-${index}`}>{word}{' '}</span>)}</p>
        </section>

        <section className="rebuild-section" data-reveal aria-labelledby="flow-heading">
          <div className="rebuild-section-heading">
            <p>How it works</p>
            <h2 id="flow-heading">The analysis stays connected to the document and the role you chose.</h2>
          </div>
          <div className="rebuild-steps">
            {steps.map(([number, title, copy]) => (
              <article className="rebuild-step" key={number}>
                <span className="rebuild-step__number">{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rebuild-section" data-reveal aria-labelledby="questions-heading">
          <div className="rebuild-section-heading">
            <p>Questions</p>
            <h2 id="questions-heading">A clear place to begin.</h2>
          </div>
          <div className="rebuild-faq">
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rebuild-closing" data-reveal aria-labelledby="closing-heading">
          <h2 id="closing-heading">Bring the resume. Bring the role. Leave with a clearer next step.</h2>
          <p>Create an account to keep your analyses, access your private documents, and return to the evidence whenever you need it.</p>
          <Link className="rebuild-button" to="/register">Create your account</Link>
        </section>
      </div>

      <footer className="rebuild-footer">
        <span>ResumeIQ</span>
        <span>Career intelligence grounded in your own documents.</span>
      </footer>
    </main>
  )
}
