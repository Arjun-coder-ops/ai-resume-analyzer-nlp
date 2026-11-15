import { lazy, Suspense, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import BrandMark from '../components/BrandMark'

const HeroScene = lazy(() => import('../components/HeroScene'))
gsap.registerPlugin(useGSAP, ScrollTrigger)

const story = [
  ['01', 'Read the document', 'ResumeIQ extracts the experience, skills, and language your own resume contains.'],
  ['02', 'Frame the role', 'A target description gives those signals a purpose and makes gaps legible.'],
  ['03', 'Make the next edit', 'Review compatibility, evidence, and recommendations before changing your resume.'],
]

export default function Landing() {
  const root = useRef(null)
  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ defaults: { ease: 'power4.out' } })
        .from('[data-brand]', { opacity: 0, scale: .8, duration: .55 })
        .from('[data-hero-line]', { yPercent: 110, stagger: .11, duration: .85 }, '-=.2')
        .from('[data-hero-copy], [data-hero-cta]', { opacity: 0, y: 20, stagger: .1, duration: .5 }, '-=.4')
      gsap.utils.toArray('[data-story]').forEach((section, index) => {
        gsap.from(section.querySelectorAll('[data-story-part]'), { x: index % 2 ? 44 : -44, opacity: 0, stagger: .14, duration: .75, ease: 'power3.out', scrollTrigger: { trigger: section, start: 'top 72%', once: true } })
      })
    })
    return () => media.revert()
  }, { scope: root })

  return <main className="cinema-site" ref={root}>
    <a className="skip-link" href="#cinema-content">Skip to content</a>
    <nav className="cinema-nav" aria-label="Public navigation"><Link to="/" data-brand><BrandMark /></Link><div><Link to="/login">Sign in</Link><Link className="cinema-nav__cta" to="/register">Create account</Link></div></nav>
    <div id="cinema-content">
      <section className="cinema-hero" aria-labelledby="cinema-title">
        <div className="cinema-hero__copy"><p className="cinema-label">Resume intelligence, grounded in evidence</p><h1 id="cinema-title"><span data-hero-line>Make your</span><span data-hero-line>experience</span><span data-hero-line>move with you.</span></h1><p data-hero-copy>ResumeIQ compares your own resume with the opportunity in front of you, so the next revision starts with a clearer signal.</p><div data-hero-cta><Link className="cinema-button" to="/register">Analyze a resume <span aria-hidden="true">↗</span></Link><small>Private account access. PDF resume upload.</small></div></div>
        <div className="cinema-hero__scene"><Suspense fallback={<div className="hero-scene hero-scene--fallback"><span>Resume ↔ role</span></div>}><HeroScene /></Suspense><p>Illustrative 3D product moment</p></div>
      </section>
      <section className="cinema-manifesto" data-story><p data-story-part>Careers are not a keyword game.</p><p data-story-part>They are a body of work, understood in context.</p></section>
      <section className="cinema-story" aria-label="How ResumeIQ works">{story.map(([number, title, copy]) => <article data-story key={number}><span data-story-part>{number}</span><div data-story-part><h2>{title}</h2><p>{copy}</p></div><i data-story-part aria-hidden="true" /></article>)}</section>
      <section className="cinema-preview" data-story><div data-story-part><p className="cinema-label">Inside the workspace</p><h2>A real analysis, made usable.</h2><p>Completed analyses keep the compatibility score, qualification context, skills, recommendations, history, and private document actions together.</p><Link className="cinema-button cinema-button--light" to="/login">Open workspace</Link></div><div className="cinema-preview__screen" data-story-part><header><BrandMark compact /><span>Illustrative preview</span></header><div><p>Compatibility</p><strong>Evidence first</strong><ul><li>Matched skills</li><li>Role requirements</li><li>Recommendations</li></ul></div></div></section>
      <section className="cinema-close" data-story><p className="cinema-label" data-story-part>Make the decision visible</p><h2 data-story-part>Bring your resume and the role you want next.</h2><Link className="cinema-button cinema-button--coral" data-story-part to="/register">Create your account</Link></section>
    </div>
    <footer className="cinema-footer"><BrandMark /><p>Career intelligence that stays connected to your own document.</p><nav aria-label="Footer navigation"><Link to="/login">Sign in</Link><Link to="/register">Create account</Link><Link to="/dashboard">Workspace</Link></nav><small>© 2026 ResumeIQ</small></footer>
  </main>
}
