// components/ResultsPanel.jsx - Comprehensive analysis results display with full resume sections

import {
  CheckCircle2, XCircle, Lightbulb, Briefcase, FileText, Clock,
  User, Mail, Phone, MapPin, Globe, Linkedin, Github, Award,
  BookOpen, Layers, ExternalLink, Languages, Sparkles
} from 'lucide-react'
import ScoreRing from './ScoreRing'

export default function ResultsPanel({ data = {} }) {
  const score = data.score || 0
  const matchedSkills = Array.isArray(data.matchedSkills) ? data.matchedSkills : []
  const missingSkills = Array.isArray(data.missingSkills) ? data.missingSkills : []
  const extractedSkills = Array.isArray(data.extractedSkills) ? data.extractedSkills : []
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : []
  const candidateInfo = data.candidateInfo || {}
  const summary = data.summary || ''
  const experience = data.experience || []
  const education = data.education || []
  const projects = data.projects || []
  const certifications = Array.isArray(data.certifications) ? data.certifications : []
  const languages = Array.isArray(data.languages) ? data.languages : []
  const achievements = Array.isArray(data.achievements) ? data.achievements : []
  const jobTitle = data.jobTitle || 'Position Analysis'
  const resumeName = data.resumeOriginalName || data.resumeName || 'Resume.pdf'
  const createdAt = data.createdAt

  const formatDate = (d) =>
    d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''

  // Has candidate contact info
  const hasContact = Boolean(
    candidateInfo.email || candidateInfo.phone || candidateInfo.location ||
    candidateInfo.linkedin || candidateInfo.github || candidateInfo.portfolio
  )

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Header Card ──────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="section-label">ATS Analysis Complete</span>
              {candidateInfo.name && (
                <span className="text-xs font-medium text-volt-400 bg-volt-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <User size={11} /> {candidateInfo.name}
                </span>
              )}
            </div>
            <h3 className="font-display font-700 text-ink-100 text-xl">{jobTitle}</h3>
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-500">
            <span className="flex items-center gap-1.5"><FileText size={13} />{resumeName}</span>
            {createdAt && (
              <span className="flex items-center gap-1.5"><Clock size={13} />{formatDate(createdAt)}</span>
            )}
          </div>
        </div>

        {/* Candidate Contact Details */}
        {hasContact && (
          <div className="pt-3 border-t border-ink-800/80 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-ink-400">
            {candidateInfo.email && (
              <a href={`mailto:${candidateInfo.email}`} className="flex items-center gap-1.5 hover:text-volt-400 transition-colors">
                <Mail size={12} className="text-volt-400" />
                <span>{candidateInfo.email}</span>
              </a>
            )}
            {candidateInfo.phone && (
              <a href={`tel:${candidateInfo.phone}`} className="flex items-center gap-1.5 hover:text-volt-400 transition-colors">
                <Phone size={12} className="text-volt-400" />
                <span>{candidateInfo.phone}</span>
              </a>
            )}
            {candidateInfo.location && (
              <span className="flex items-center gap-1.5 text-ink-400">
                <MapPin size={12} className="text-ink-500" />
                <span>{candidateInfo.location}</span>
              </span>
            )}
            {candidateInfo.linkedin && (
              <a href={candidateInfo.linkedin.startsWith('http') ? candidateInfo.linkedin : `https://${candidateInfo.linkedin}`}
                 target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-blue-400 transition-colors">
                <Linkedin size={12} className="text-blue-400" />
                <span>LinkedIn</span>
                <ExternalLink size={10} />
              </a>
            )}
            {candidateInfo.github && (
              <a href={candidateInfo.github.startsWith('http') ? candidateInfo.github : `https://${candidateInfo.github}`}
                 target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-ink-100 transition-colors">
                <Github size={12} className="text-ink-200" />
                <span>GitHub</span>
                <ExternalLink size={10} />
              </a>
            )}
            {candidateInfo.portfolio && (
              <a href={candidateInfo.portfolio.startsWith('http') ? candidateInfo.portfolio : `https://${candidateInfo.portfolio}`}
                 target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-volt-400 transition-colors">
                <Globe size={12} className="text-volt-400" />
                <span>Portfolio</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Score + Quick Stats ──────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-6 flex items-center justify-center sm:row-span-1">
          <ScoreRing score={score} />
        </div>

        <div className="sm:col-span-2 grid grid-cols-2 gap-4">
          <StatCard
            icon={<CheckCircle2 size={18} className="text-volt-400" />}
            value={matchedSkills.length}
            label="Matched Skills"
            color="volt"
          />
          <StatCard
            icon={<XCircle size={18} className="text-red-400" />}
            value={missingSkills.length}
            label="Missing Skills"
            color="red"
          />
          <StatCard
            icon={<Layers size={18} className="text-blue-400" />}
            value={extractedSkills.length || matchedSkills.length}
            label="Total Resume Skills"
            color="blue"
          />
          <StatCard
            icon={<Lightbulb size={18} className="text-amber-400" />}
            value={suggestions.length}
            label="ATS Suggestions"
            color="amber"
          />
        </div>
      </div>

      {/* ── Professional Summary ─────────────────────────────── */}
      {summary && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-volt-400" />
            <h4 className="font-display font-600 text-ink-100 text-sm">Professional Summary</h4>
          </div>
          <p className="text-ink-300 text-sm leading-relaxed whitespace-pre-line">{summary}</p>
        </div>
      )}

      {/* ── Skills Comparison (Matched vs Missing) ───────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Matched */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={15} className="text-volt-400" />
            <h4 className="font-display font-600 text-ink-100 text-sm">Matched Skills</h4>
            <span className="ml-auto text-xs font-mono text-volt-400 bg-volt-400/10 px-2 py-0.5 rounded-full">
              {matchedSkills.length}
            </span>
          </div>
          {matchedSkills.length === 0 ? (
            <p className="text-ink-500 text-sm">No matching job skills found yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {matchedSkills.map((skill, i) => (
                <span key={i} className="badge-matched animate-scale-in" style={{ animationDelay: `${i * 0.03}s` }}>
                  <CheckCircle2 size={10} />
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Missing */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <XCircle size={15} className="text-red-400" />
            <h4 className="font-display font-600 text-ink-100 text-sm">Missing Skills</h4>
            <span className="ml-auto text-xs font-mono text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full">
              {missingSkills.length}
            </span>
          </div>
          {missingSkills.length === 0 ? (
            <p className="text-volt-400 text-sm flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Outstanding! All target job skills matched.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {missingSkills.map((skill, i) => (
                <span key={i} className="badge-missing animate-scale-in" style={{ animationDelay: `${i * 0.03}s` }}>
                  <XCircle size={10} />
                  {skill}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── All Skills Extracted From Resume ─────────────────── */}
      {extractedSkills.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={15} className="text-volt-400" />
            <h4 className="font-display font-600 text-ink-100 text-sm">All Identified Resume Skills</h4>
            <span className="ml-auto text-xs font-mono text-ink-400 bg-ink-800 px-2 py-0.5 rounded-full">
              {extractedSkills.length} total
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {extractedSkills.map((skill, i) => (
              <span key={i} className="text-xs bg-ink-800/80 hover:bg-ink-700/80 text-ink-300 border border-ink-700/60 px-2.5 py-1 rounded-lg transition-colors">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Work Experience ──────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase size={16} className="text-volt-400" />
          <h4 className="font-display font-600 text-ink-100 text-sm">Work Experience</h4>
        </div>

        {Array.isArray(experience) && experience.length > 0 ? (
          <div className="space-y-4">
            {experience.map((exp, idx) => {
              if (typeof exp === 'string') {
                return (
                  <p key={idx} className="text-ink-300 text-sm leading-relaxed whitespace-pre-line">{exp}</p>
                )
              }
              return (
                <div key={idx} className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/40 space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h5 className="font-display font-600 text-ink-100 text-sm">{exp.role || 'Role'}</h5>
                      {exp.company && (
                        <p className="text-volt-400 text-xs font-medium mt-0.5">{exp.company}</p>
                      )}
                    </div>
                    {(exp.duration || exp.location) && (
                      <div className="text-right text-xs text-ink-500">
                        {exp.duration && <span className="font-mono bg-ink-800 px-2 py-0.5 rounded">{exp.duration}</span>}
                        {exp.location && <span className="ml-2 text-ink-500">{exp.location}</span>}
                      </div>
                    )}
                  </div>

                  {Array.isArray(exp.details) && exp.details.length > 0 ? (
                    <ul className="space-y-1.5 mt-2 text-xs text-ink-300 leading-relaxed">
                      {exp.details.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2">
                          <span className="text-volt-400 font-mono mt-0.5">•</span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  ) : exp.details ? (
                    <p className="text-xs text-ink-300 leading-relaxed">{String(exp.details)}</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : typeof experience === 'string' && experience.trim().length > 0 ? (
          <p className="text-ink-300 text-sm leading-relaxed whitespace-pre-line">{experience}</p>
        ) : (
          <p className="text-ink-500 text-sm">No work experience entries extracted.</p>
        )}
      </div>

      {/* ── Education ────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-volt-400" />
          <h4 className="font-display font-600 text-ink-100 text-sm">Education</h4>
        </div>

        {Array.isArray(education) && education.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {education.map((edu, idx) => {
              if (typeof edu === 'string') {
                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-ink-800/40 border border-ink-700/40">
                    <p className="text-ink-200 text-sm">{edu}</p>
                  </div>
                )
              }
              return (
                <div key={idx} className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/40 flex flex-col justify-between">
                  <div>
                    <h5 className="font-display font-600 text-ink-100 text-sm">{edu.degree || 'Degree'}</h5>
                    {edu.institution && (
                      <p className="text-volt-400 text-xs font-medium mt-0.5">{edu.institution}</p>
                    )}
                    {edu.details && (
                      <p className="text-ink-400 text-xs mt-2 leading-relaxed">{edu.details}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-ink-500">
                    {edu.year && <span className="font-mono">{edu.year}</span>}
                    {edu.gpa && <span className="bg-ink-800 px-2 py-0.5 rounded text-volt-400">GPA: {edu.gpa}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : typeof education === 'string' && education.trim().length > 0 ? (
          <p className="text-ink-300 text-sm leading-relaxed whitespace-pre-line">{education}</p>
        ) : (
          <p className="text-ink-500 text-sm">No education entries extracted.</p>
        )}
      </div>

      {/* ── Projects ─────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Layers size={16} className="text-volt-400" />
          <h4 className="font-display font-600 text-ink-100 text-sm">Projects</h4>
        </div>

        {Array.isArray(projects) && projects.length > 0 ? (
          <div className="space-y-3">
            {projects.map((proj, idx) => {
              if (typeof proj === 'string') {
                return (
                  <div key={idx} className="flex gap-2 items-start text-sm text-ink-300">
                    <span className="text-volt-400 font-mono mt-0.5">→</span>
                    <span>{proj}</span>
                  </div>
                )
              }
              return (
                <div key={idx} className="p-4 rounded-xl bg-ink-800/40 border border-ink-700/40 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h5 className="font-display font-600 text-ink-100 text-sm">{proj.name || 'Project'}</h5>
                    {proj.link && (
                      <a href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`}
                         target="_blank" rel="noreferrer"
                         className="text-xs text-volt-400 hover:underline flex items-center gap-1">
                        View Project <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-ink-300 text-xs leading-relaxed">{proj.description}</p>
                  )}
                  {Array.isArray(proj.technologies) && proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {proj.technologies.map((t, tIdx) => (
                        <span key={tIdx} className="text-[11px] font-mono bg-ink-800 text-ink-400 px-2 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-ink-500 text-sm">No projects extracted.</p>
        )}
      </div>

      {/* ── Certifications, Languages & Achievements ─────────── */}
      {(certifications.length > 0 || languages.length > 0 || achievements.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Certifications */}
          {certifications.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Award size={15} className="text-volt-400" />
                <h4 className="font-display font-600 text-ink-100 text-sm">Certifications</h4>
              </div>
              <ul className="space-y-1.5 text-xs text-ink-300">
                {certifications.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-volt-400 mt-0.5">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Languages */}
          {languages.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Languages size={15} className="text-blue-400" />
                <h4 className="font-display font-600 text-ink-100 text-sm">Languages</h4>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {languages.map((l, i) => (
                  <span key={i} className="text-xs bg-ink-800 text-ink-300 px-2.5 py-1 rounded-lg border border-ink-700/40">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {achievements.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={15} className="text-amber-400" />
                <h4 className="font-display font-600 text-ink-100 text-sm">Achievements</h4>
              </div>
              <ul className="space-y-1.5 text-xs text-ink-300">
                {achievements.map((a, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 mt-0.5">★</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Improvement Suggestions ─────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb size={16} className="text-amber-400" />
          <h4 className="font-display font-600 text-ink-100 text-sm">ATS Optimization Recommendations</h4>
        </div>
        <div className="space-y-3">
          {suggestions.map((s, i) => (
            <div key={i}
              className="flex gap-3 p-3.5 rounded-xl bg-ink-800/60 border border-ink-700/50 animate-fade-up"
              style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="w-5 h-5 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-amber-400 font-mono text-xs font-700">{i + 1}</span>
              </div>
              <p className="text-ink-300 text-sm leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Stat card sub-component
function StatCard({ icon, value, label, color }) {
  const borders = { volt: 'border-volt-400/10', red: 'border-red-400/10', blue: 'border-blue-400/10', amber: 'border-amber-400/10' }
  const bgs     = { volt: 'bg-volt-400/5',     red: 'bg-red-400/5',     blue: 'bg-blue-400/5',     amber: 'bg-amber-400/5'     }
  return (
    <div className={`glass-card p-4 ${bgs[color]} ${borders[color]}`}>
      <div className="flex items-start justify-between">
        {icon}
      </div>
      <p className="font-display font-800 text-2xl text-ink-50 mt-2">{value}</p>
      <p className="text-ink-500 text-xs mt-0.5">{label}</p>
    </div>
  )
}
