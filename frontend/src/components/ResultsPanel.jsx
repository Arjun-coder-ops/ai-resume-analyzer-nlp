// components/ResultsPanel.jsx - Interior Design System Results Presentation

import { useState } from 'react'
import {
  CheckCircle2, CircleAlert, TriangleAlert, Lightbulb, BriefcaseBusiness,
  FileText, Clock, UserRound, Mail, Phone, MapPin, Globe, Linkedin,
  Github, Award, GraduationCap, FolderGit2, ExternalLink, Languages,
  Trophy, Check, Tags, ShieldCheck, X
} from 'lucide-react'
import ScoreRing from './ScoreRing'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card'
import { Badge } from './ui/Badge'
import { getMatchLevel, getScoreVariant } from '../utils/scoring'

// ── Defensive helper to validate external URLs ────────────────
function safeUrl(val) {
  if (!val || typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`
}

// ── Defensive helper to safely extract string content ─────────
function safeText(val) {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object') {
    return val.tip || val.text || val.suggestion || val.content || val.message || JSON.stringify(val)
  }
  return ''
}

export default function ResultsPanel({ data = {} }) {
  const [activeRecTab, setActiveRecTab] = useState('all')

  const score = Math.round(Number(data.score) || 0)
  const matchLevel = data.matchLevel || getMatchLevel(score)

  const scoringBreakdown = data.scoringBreakdown || {}
  const recommendations = data.recommendations || {}

  // Education & Mandatory Qualification Evidence
  const eduEvidence = scoringBreakdown.education_credentials?.evidence || {}
  const missingMandatoryCreds = Array.isArray(eduEvidence.mandatory_credentials_missing)
    ? eduEvidence.mandatory_credentials_missing
    : []
  const missingMandatoryDegree = Boolean(eduEvidence.missing_mandatory_degree)
  const structuredWarnings = Array.isArray(eduEvidence.structured_warnings)
    ? eduEvidence.structured_warnings
    : []
  const qualificationWarnings = Array.isArray(eduEvidence.warnings)
    ? eduEvidence.warnings
    : []
  const mandatoryCredsRequired = Array.isArray(eduEvidence.mandatory_credentials_required)
    ? eduEvidence.mandatory_credentials_required
    : []
  const mandatoryCredsMatched = Array.isArray(eduEvidence.mandatory_credentials_matched)
    ? eduEvidence.mandatory_credentials_matched
    : []
  const preferredCredsRequired = Array.isArray(eduEvidence.preferred_credentials_required)
    ? eduEvidence.preferred_credentials_required
    : []
  const preferredCredsMatched = Array.isArray(eduEvidence.preferred_credentials_matched)
    ? eduEvidence.preferred_credentials_matched
    : []

  const hasMandatoryGap =
    missingMandatoryCreds.length > 0 ||
    missingMandatoryDegree ||
    structuredWarnings.some(
      (w) =>
        w.type === 'missing_mandatory_credential' ||
        w.type === 'missing_mandatory_degree' ||
        w.type === 'in_progress_degree_for_completed_role'
    )

  const matchedSkills = Array.isArray(data.matchedSkills) ? data.matchedSkills : []
  const missingSkills = Array.isArray(data.missingSkills) ? data.missingSkills : []
  const extractedSkills = Array.isArray(data.extractedSkills) ? data.extractedSkills : []
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : []

  const candidateInfo = data.candidateInfo || {}
  const summary = safeText(data.summary)
  const experience = Array.isArray(data.experience)
    ? data.experience
    : typeof data.experience === 'string'
    ? [data.experience]
    : []
  const education = Array.isArray(data.education)
    ? data.education
    : typeof data.education === 'string'
    ? [data.education]
    : []
  const projects = Array.isArray(data.projects) ? data.projects : []
  const certifications = Array.isArray(data.certifications) ? data.certifications : []
  const languages = Array.isArray(data.languages) ? data.languages : []
  const achievements = Array.isArray(data.achievements) ? data.achievements : []

  const jobTitle = safeText(data.jobTitle) || 'Position Analysis'
  const resumeName =
    safeText(data.resumeOriginalName) || safeText(data.resumeName) || 'Resume.pdf'
  const createdAt = data.createdAt

  const formatDate = (d) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  // Candidate Contact Verification
  const candidateEmail = safeText(candidateInfo.email)
  const candidatePhone = safeText(candidateInfo.phone)
  const candidateLocation = safeText(candidateInfo.location)
  const candidateLinkedin = safeUrl(candidateInfo.linkedin)
  const candidateGithub = safeUrl(candidateInfo.github)
  const candidatePortfolio = safeUrl(candidateInfo.portfolio)
  const candidateName = safeText(candidateInfo.name)

  const hasContact = Boolean(
    candidateEmail || candidatePhone || candidateLocation ||
    candidateLinkedin || candidateGithub || candidatePortfolio
  )

  // ── 5-Pillar Weighted Scoring Breakdown ────────────────────
  const pillars = [
    {
      key: 'skills_match',
      name: 'Skills & Keywords Match',
      weight: '40% weight',
      icon: <Tags size={14} className="text-foreground" aria-hidden="true" />,
      score:
        scoringBreakdown.skills_match?.score ??
        (missingSkills.length === 0 && matchedSkills.length > 0
          ? 40
          : Math.round(
              (matchedSkills.length /
                Math.max(1, matchedSkills.length + missingSkills.length)) *
                40
            )),
      max: 40,
      status: scoringBreakdown.skills_match?.status || (missingSkills.length === 0 ? '100% Match' : 'Aligned'),
      explanation: scoringBreakdown.skills_match?.explanation,
      barColor: 'bg-primary',
    },
    {
      key: 'experience_alignment',
      name: 'Experience & Responsibilities',
      weight: '25% weight',
      icon: <BriefcaseBusiness size={14} className="text-foreground" aria-hidden="true" />,
      score: scoringBreakdown.experience_alignment?.score ?? 0,
      max: 25,
      status: scoringBreakdown.experience_alignment?.status || 'Needs Evaluation',
      explanation: scoringBreakdown.experience_alignment?.explanation,
      barColor: 'bg-primary/80',
    },
    {
      key: 'education_credentials',
      name: 'Education & Credentials',
      weight: '15% weight',
      icon: <GraduationCap size={14} className="text-foreground" aria-hidden="true" />,
      score: scoringBreakdown.education_credentials?.score ?? 0,
      max: 15,
      status: scoringBreakdown.education_credentials?.status || 'Needs Evaluation',
      explanation: scoringBreakdown.education_credentials?.explanation,
      barColor: 'bg-primary/70',
    },
    {
      key: 'content_impact',
      name: 'Measurable Impact & Metrics',
      weight: '10% weight',
      icon: <Trophy size={14} className="text-foreground" aria-hidden="true" />,
      score: scoringBreakdown.content_impact?.score ?? 0,
      max: 10,
      status: scoringBreakdown.content_impact?.status || 'Needs Evaluation',
      explanation: scoringBreakdown.content_impact?.explanation,
      barColor: 'bg-primary/60',
    },
    {
      key: 'ats_parseability',
      name: 'ATS Formatting & Parseability',
      weight: '10% weight',
      icon: <FileText size={14} className="text-foreground" aria-hidden="true" />,
      score: scoringBreakdown.ats_parseability?.score ?? 0,
      max: 10,
      status: scoringBreakdown.ats_parseability?.status || 'Needs Evaluation',
      explanation: scoringBreakdown.ats_parseability?.explanation,
      barColor: 'bg-primary/50',
    },
  ]

  // Categorized recommendations extraction
  const recKeywords = Array.isArray(recommendations.keyword_placement)
    ? recommendations.keyword_placement
    : []
  const recImpact = Array.isArray(recommendations.quantifiable_impact)
    ? recommendations.quantifiable_impact
    : []
  const recVerbs = Array.isArray(recommendations.action_verbs)
    ? recommendations.action_verbs
    : []
  const recCompliance = Array.isArray(recommendations.ats_compliance)
    ? recommendations.ats_compliance
    : []

  return (
    <div className="space-y-6 animate-scale-in">
      {/* ══════════════════════════════════════════════════════ */}
      {/* 1. AUDIT HEADER & DOCUMENT CONTEXT                     */}
      {/* ══════════════════════════════════════════════════════ */}
      <Card className="shadow-lift border border-border/90">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="secondary" className="font-mono text-[11px]">
                  Evaluation complete
                </Badge>
                {candidateName && (
                  <Badge variant="outline" className="text-xs gap-1.5">
                    <UserRound size={11} aria-hidden="true" />
                    <span>{candidateName}</span>
                  </Badge>
                )}
              </div>
              <h2 className="font-sans font-semibold text-xl sm:text-2xl text-foreground tracking-tight">
                {jobTitle}
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono shrink-0">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-badge bg-secondary border border-border/60">
                <FileText size={13} className="text-foreground" aria-hidden="true" />
                <span className="truncate max-w-[12rem]">{resumeName}</span>
              </span>
              {createdAt && (
                <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-badge bg-secondary border border-border/60">
                  <Clock size={13} aria-hidden="true" />
                  <span>{formatDate(createdAt)}</span>
                </span>
              )}
            </div>
          </div>
        </CardHeader>

        {/* Candidate Contact Bar */}
        {hasContact && (
          <CardContent className="pt-2">
            <div className="pt-3 border-t border-border/70 flex flex-wrap items-center gap-y-2 gap-x-5 text-xs text-muted-foreground">
              {candidateEmail && (
                <a
                  href={`mailto:${candidateEmail}`}
                  className="flex items-center gap-1.5 text-foreground hover:underline"
                >
                  <Mail size={13} aria-hidden="true" />
                  <span>{candidateEmail}</span>
                </a>
              )}
              {candidatePhone && (
                <a
                  href={`tel:${candidatePhone}`}
                  className="flex items-center gap-1.5 text-foreground hover:underline"
                >
                  <Phone size={13} aria-hidden="true" />
                  <span>{candidatePhone}</span>
                </a>
              )}
              {candidateLocation && (
                <span className="flex items-center gap-1.5">
                  <MapPin size={13} aria-hidden="true" />
                  <span>{candidateLocation}</span>
                </span>
              )}
              {candidateLinkedin && (
                <a
                  href={candidateLinkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-foreground hover:underline"
                >
                  <Linkedin size={13} aria-hidden="true" />
                  <span>LinkedIn</span>
                  <ExternalLink size={10} aria-hidden="true" />
                </a>
              )}
              {candidateGithub && (
                <a
                  href={candidateGithub}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-foreground hover:underline"
                >
                  <Github size={13} aria-hidden="true" />
                  <span>GitHub</span>
                  <ExternalLink size={10} aria-hidden="true" />
                </a>
              )}
              {candidatePortfolio && (
                <a
                  href={candidatePortfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-foreground hover:underline"
                >
                  <Globe size={13} aria-hidden="true" />
                  <span>Portfolio</span>
                  <ExternalLink size={10} aria-hidden="true" />
                </a>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* 2. OVERALL ATS SCORECARD & 5-PILLAR BREAKDOWN          */}
      {/* ══════════════════════════════════════════════════════ */}
      <Card className="shadow-lift">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-lg">ATS compatibility scorecard</CardTitle>
              <CardDescription>
                Weighted evaluation across key screening criteria used by applicant tracking systems.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasMandatoryGap && (
                <Badge variant="destructive" className="gap-1 animate-pulse font-mono text-[11px]">
                  <TriangleAlert size={12} aria-hidden="true" />
                  <span>Mandatory Gap Detected</span>
                </Badge>
              )}
              <Badge variant={getScoreVariant(score)}>
                {matchLevel}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mandatory Qualification Notice */}
          {hasMandatoryGap && (
            <div className="p-4 rounded-badge bg-destructive/10 border border-destructive/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                  <TriangleAlert size={16} aria-hidden="true" />
                  <span>Mandatory Qualification Notice</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono border-destructive/40 text-destructive">
                  Critical Verification Item
                </Badge>
              </div>

              <div className="space-y-2">
                {structuredWarnings.map((warn, i) => (
                  <div key={i} className="p-3 rounded-cell bg-card/80 border border-border/80 text-xs space-y-1">
                    <div className="font-semibold text-foreground flex items-center justify-between">
                      <span>{warn.requirement || 'Required Qualification'}</span>
                      <Badge variant="destructive" className="text-[10px] py-0 px-1.5 font-mono">
                        Unverified in Document
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground font-medium">Detected Requirement: </strong>
                      {warn.detected_requirement}
                    </p>
                    <p className="text-muted-foreground">
                      <strong className="text-foreground font-medium">Resume Evidence: </strong>
                      {warn.resume_evidence}
                    </p>
                  </div>
                ))}
                {structuredWarnings.length === 0 && qualificationWarnings.map((msg, i) => (
                  <div key={i} className="p-2.5 rounded-cell bg-card/80 border border-border/80 text-xs text-foreground">
                    {msg}
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed italic border-t border-destructive/20 pt-2">
                Note: Qualification verification is based on automated text parsing. Absence of a keyword in the submitted resume indicates a missing text match, not an automated disqualification. Please verify credentials directly with the applicant.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Score Ring Gauge inside Recessed Well */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-card bg-secondary/50 border border-border shadow-well">
              <ScoreRing score={score} matchLevel={matchLevel} />
            </div>

            {/* 5-Pillar Breakdown Bars */}
            <div className="md:col-span-7 space-y-3">
              {pillars.map((pillar) => {
                const pct = Math.min(100, Math.round((pillar.score / pillar.max) * 100))
                return (
                  <div
                    key={pillar.key}
                    className="p-3 rounded-badge bg-secondary/40 border border-border/70 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground flex items-center gap-1.5">
                        {pillar.icon}
                        <span>{pillar.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({pillar.weight})
                        </span>
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{pillar.status}</span>
                        <span className="font-mono font-semibold text-foreground tabular-nums">
                          {pillar.score}/{pillar.max}
                        </span>
                      </div>
                    </div>
                    {/* Clean Progress Rail */}
                    <div className="w-full bg-border/60 rounded-cell h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-cell transition-all duration-700 ${pillar.barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {pillar.explanation && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed pt-0.5">
                        {pillar.explanation}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Quick Metrics Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border/70">
            <MetricTile
              label="Matched skills"
              value={matchedSkills.length}
              sub="Direct requirement match"
              badge="Aligned"
            />
            <MetricTile
              label="Missing skills"
              value={missingSkills.length}
              sub={missingSkills.length === 0 ? 'Zero gaps found' : 'Recommended additions'}
              badge={missingSkills.length === 0 ? 'Optimal' : 'Action needed'}
              highlight={missingSkills.length > 0}
            />
            <MetricTile
              label="Cataloged skills"
              value={extractedSkills.length || matchedSkills.length}
              sub="Total identified in resume"
              badge="Parsed"
            />
            <MetricTile
              label="Formatting status"
              value="Standard"
              sub="Single-column clean PDF"
              badge="Passed"
            />
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* 3. SKILLS MATRIX: MATCHED VS. MISSING                  */}
      {/* ══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Matched Skills */}
        <Card className="shadow-lift">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Matched skills</CardTitle>
              </div>
              <Badge variant="success" className="font-mono tabular-nums">
                {matchedSkills.length} matched
              </Badge>
            </div>
            <CardDescription>
              Skills and technical keywords verified in both your resume and the job description.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {matchedSkills.length === 0 ? (
              <p className="text-sm text-muted-foreground">No direct skills matched yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1">
                {matchedSkills.map((skill, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1 border-border/80">
                    <CheckCircle2 size={11} className="text-foreground shrink-0" aria-hidden="true" />
                    <span>{safeText(skill)}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Missing Target Skills */}
        <Card className="shadow-lift">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TriangleAlert size={16} className="text-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Skills to develop</CardTitle>
              </div>
              <Badge
                variant={missingSkills.length === 0 ? 'success' : 'destructive'}
                className="font-mono tabular-nums"
              >
                {missingSkills.length} missing
              </Badge>
            </div>
            <CardDescription>
              Target qualifications mentioned in the job description that were not detected in your resume.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missingSkills.length === 0 ? (
              <div className="p-4 rounded-badge bg-secondary/50 border border-border text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Complete keyword alignment</p>
                <p className="text-xs text-muted-foreground leading-normal">
                  Your resume covers all primary technical requirements mentioned in this job post.
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-60 overflow-y-auto pr-1">
                {missingSkills.map((skill, i) => (
                  <Badge key={i} variant="destructive" className="text-xs gap-1">
                    <CircleAlert size={11} className="shrink-0" aria-hidden="true" />
                    <span>{safeText(skill)}</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Extracted Skills Catalog */}
      {extractedSkills.length > 0 && (
        <Card className="shadow-lift">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tags size={16} className="text-foreground" aria-hidden="true" />
                <CardTitle className="text-base">All extracted resume skills</CardTitle>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {extractedSkills.length} total
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {extractedSkills.map((s, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-badge text-xs font-medium bg-secondary text-foreground border border-border/70"
                >
                  {safeText(s)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 4. ACTIONABLE OPTIMIZATION RECOMMENDATIONS            */}
      {/* ══════════════════════════════════════════════════════ */}
      <Card className="shadow-lift">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-foreground" aria-hidden="true" />
              <CardTitle className="text-lg">Improvement recommendations</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Concrete guidance to strengthen ATS match rate
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 pt-3 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All recommendations' },
              { id: 'keywords', label: 'Keyword placement' },
              { id: 'impact', label: 'Measurable metrics' },
              { id: 'verbs', label: 'Action verbs' },
              { id: 'compliance', label: 'Formatting standards' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveRecTab(tab.id)}
                className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-colors whitespace-nowrap ${
                  activeRecTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-cap'
                    : 'bg-secondary text-muted-foreground hover:text-foreground border border-border/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Keyword Recommendations */}
          {(activeRecTab === 'all' || activeRecTab === 'keywords') &&
            recKeywords.map((tip, i) => (
              <RecommendationCard
                key={`kw-${i}`}
                category="Keyword placement"
                content={safeText(tip)}
              />
            ))}

          {/* Measurable Impact */}
          {(activeRecTab === 'all' || activeRecTab === 'impact') &&
            recImpact.map((tip, i) => (
              <RecommendationCard
                key={`imp-${i}`}
                category="Measurable metrics"
                content={safeText(tip)}
              />
            ))}

          {/* Action Verbs */}
          {(activeRecTab === 'all' || activeRecTab === 'verbs') &&
            recVerbs.map((tip, i) => (
              <RecommendationCard
                key={`verb-${i}`}
                category="Action verbs"
                content={safeText(tip)}
              />
            ))}

          {/* ATS Compliance */}
          {(activeRecTab === 'all' || activeRecTab === 'compliance') &&
            recCompliance.map((tip, i) => (
              <RecommendationCard
                key={`comp-${i}`}
                category="Formatting standards"
                content={safeText(tip)}
              />
            ))}

          {/* Fallback to general suggestions array if category arrays are empty */}
          {recKeywords.length === 0 &&
            recImpact.length === 0 &&
            suggestions.length > 0 &&
            suggestions.map((s, i) => (
              <RecommendationCard
                key={`sug-${i}`}
                category={`Recommendation #${i + 1}`}
                content={safeText(s)}
              />
            ))}
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* 5. PARSED RESUME CONTENT (Supported sections only)    */}
      {/* ══════════════════════════════════════════════════════ */}

      {/* Professional Summary */}
      {summary && (
        <Card className="shadow-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Professional summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Work Experience */}
      {experience.length > 0 && (
        <Card className="shadow-lift">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness size={16} className="text-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Work experience</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {experience.map((exp, idx) => {
              if (typeof exp === 'string') {
                return (
                  <p key={idx} className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {exp}
                  </p>
                )
              }
              const roleTitle = safeText(exp.role) || 'Position'
              const company = safeText(exp.company)
              const duration = safeText(exp.duration)
              const location = safeText(exp.location)
              const details = Array.isArray(exp.details)
                ? exp.details
                : exp.details
                ? [safeText(exp.details)]
                : []

              return (
                <div key={idx} className="p-4 rounded-badge bg-secondary/40 border border-border/70 space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{roleTitle}</h4>
                      {company && (
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                          {company}
                        </p>
                      )}
                    </div>
                    {(duration || location) && (
                      <div className="text-xs font-mono text-muted-foreground text-right">
                        {duration && <span>{duration}</span>}
                        {location && <span className="ml-2">({location})</span>}
                      </div>
                    )}
                  </div>

                  {details.length > 0 && (
                    <ul className="space-y-1.5 text-xs text-foreground/90 leading-relaxed pt-1">
                      {details.map((bullet, bIdx) => (
                        <li key={bIdx} className="flex items-start gap-2">
                          <Check size={12} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{safeText(bullet)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Education & Qualifications */}
      {(education.length > 0 || mandatoryCredsRequired.length > 0 || preferredCredsRequired.length > 0) && (
        <Card className="shadow-lift">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className="text-foreground" aria-hidden="true" />
                <CardTitle className="text-base">Education & qualifications</CardTitle>
              </div>
              {eduEvidence.degree_level && (
                <Badge variant="outline" className="text-xs font-mono">
                  {eduEvidence.degree_level}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Role Qualification Requirements */}
            {(mandatoryCredsRequired.length > 0 || preferredCredsRequired.length > 0) && (
              <div className="p-3.5 rounded-badge bg-secondary/50 border border-border/80 space-y-2">
                <span className="text-xs font-semibold text-foreground block">
                  Target role credential verification
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  {mandatoryCredsRequired.map((req, i) => {
                    const isMatched = mandatoryCredsMatched.some((m) =>
                      String(m).toLowerCase().includes(req.toLowerCase())
                    )
                    return (
                      <Badge
                        key={`mand-${i}`}
                        variant={isMatched ? 'success' : 'destructive'}
                        className="gap-1 font-mono text-[11px]"
                      >
                        <ShieldCheck size={11} aria-hidden="true" />
                        <span>Mandatory: {req}</span>
                        <span>{isMatched ? '(Documented)' : '(Unverified)'}</span>
                      </Badge>
                    )
                  })}
                  {preferredCredsRequired.map((req, i) => {
                    const isMatched = preferredCredsMatched.some((m) =>
                      String(m).toLowerCase().includes(req.toLowerCase())
                    )
                    return (
                      <Badge
                        key={`pref-${i}`}
                        variant={isMatched ? 'secondary' : 'outline'}
                        className="gap-1 font-mono text-[11px]"
                      >
                        <span>Preferred (Optional): {req}</span>
                        <span>{isMatched ? '(Documented)' : '(Not Found)'}</span>
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )}

            {education.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {education.map((edu, idx) => {
                  if (typeof edu === 'string') {
                    return (
                      <div key={idx} className="p-3.5 rounded-badge bg-secondary/40 border border-border/70">
                        <p className="text-sm text-foreground">{edu}</p>
                      </div>
                    )
                  }
                  const degree = safeText(edu.degree) || 'Degree'
                  const institution = safeText(edu.institution)
                  const details = safeText(edu.details)
                  const year = safeText(edu.year)

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-badge bg-secondary/40 border border-border/70 space-y-1"
                    >
                      <h4 className="text-sm font-semibold text-foreground">{degree}</h4>
                      {institution && (
                        <p className="text-xs text-muted-foreground">{institution}</p>
                      )}
                      {year && (
                        <p className="text-[11px] font-mono text-muted-foreground">{year}</p>
                      )}
                      {details && (
                        <p className="text-xs text-foreground/90 pt-1 leading-normal">{details}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No collegiate education section parsed from resume.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <Card className="shadow-lift">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FolderGit2 size={16} className="text-foreground" aria-hidden="true" />
              <CardTitle className="text-base">Key projects</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.map((proj, idx) => {
              if (typeof proj === 'string') {
                return (
                  <div key={idx} className="text-sm text-foreground">
                    {proj}
                  </div>
                )
              }
              const projName = safeText(proj.name) || 'Project'
              const projLink = safeUrl(proj.link)
              const projDesc = safeText(proj.description)
              const technologies = Array.isArray(proj.technologies) ? proj.technologies : []

              return (
                <div key={idx} className="p-3.5 rounded-badge bg-secondary/40 border border-border/70 space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{projName}</h4>
                    {projLink && (
                      <a
                        href={projLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-foreground font-medium underline underline-offset-2 flex items-center gap-1"
                      >
                        <span>Project link</span>
                        <ExternalLink size={11} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                  {projDesc && (
                    <p className="text-xs text-foreground/90 leading-relaxed">{projDesc}</p>
                  )}
                  {technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {technologies.map((t, tIdx) => (
                        <span
                          key={tIdx}
                          className="text-[11px] font-mono bg-card px-2 py-0.5 rounded-cell border border-border/60 text-muted-foreground"
                        >
                          {safeText(t)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Certifications & Languages (if present) */}
      {(certifications.length > 0 || languages.length > 0 || achievements.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {certifications.length > 0 && (
            <Card className="shadow-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <Award size={15} className="text-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm">Certifications</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs text-foreground">
                  {certifications.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Award size={12} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{safeText(c)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {languages.length > 0 && (
            <Card className="shadow-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <Languages size={15} className="text-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm">Languages</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {languages.map((l, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {safeText(l)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {achievements.length > 0 && (
            <Card className="shadow-lift">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5">
                  <Trophy size={15} className="text-foreground" aria-hidden="true" />
                  <CardTitle className="text-sm">Achievements</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-xs text-foreground">
                  {achievements.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Trophy size={12} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{safeText(a)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

// ── Compact Metric Tile ───────────────────────────────────────
function MetricTile({ label, value, sub, badge, highlight }) {
  return (
    <div className="p-3.5 rounded-badge bg-secondary/40 border border-border/70 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Badge variant={highlight ? 'warning' : 'secondary'} className="text-[10px] py-0 px-1.5 font-mono">
          {badge}
        </Badge>
      </div>
      <div>
        <p className="font-sans font-bold text-2xl text-foreground tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  )
}

// ── Recommendation Item Card ──────────────────────────────────
function RecommendationCard({ category, content }) {
  return (
    <div className="p-3.5 rounded-badge bg-secondary/40 border border-border/70 space-y-1">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-[10px] font-mono">
          {category}
        </Badge>
      </div>
      <p className="text-xs text-foreground leading-relaxed pt-0.5">{content}</p>
    </div>
  )
}
