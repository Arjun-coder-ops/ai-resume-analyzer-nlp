# ResumeIQ Product Requirements

## Product intent

ResumeIQ is an open-source career platform for students. It helps a student keep a verified career profile, create job-specific resumes, understand a transparent resume-to-job-description analysis, and optionally use authorized GitHub evidence to support truthful improvements. It is not an ATS, an employment guarantee, or a system for inventing qualifications.

## Initial-release outcomes

1. A student can register, securely authenticate, and control their account and personal data.
2. A student can create, import, review, version, and delete a structured career profile.
3. A student can upload a PDF resume, submit a job description, and receive a reproducible, explained analysis.
4. A student can create, edit, version, and export ATS-readable resume variants without GitHub access.
5. A student can optionally authorize read-only GitHub access and review evidence-linked suggestions before any content is applied.
6. University staff can administer their organization without unrestricted access to student-private data.

## Product principles

- Truth before score: generated suggestions require verified evidence or explicit student confirmation.
- Student control: no silent edits, no public resumes, and understandable delete/export controls.
- Explainability: every score has a rubric version and every GitHub-driven claim has a traceable source.
- Privacy by default: private resumes and repositories are not exposed through public URLs or unrelated tenants.
- Accessible, responsive, and useful without optional integrations.

## Out of scope for the free launch

Live payments, automated job applications, scraping job boards, production deployment, real university SSO activation, and unrestricted repository-code transmission to AI providers.

## Personas and key journeys

| Persona | Goal | Success signal |
| --- | --- | --- |
| Student | Tailor a truthful resume to a role | Understands score evidence and exports an approved version |
| University staff | Support cohorts safely | Sees aggregate/consented data within their organization |
| Contributor | Self-host and extend ResumeIQ | Can set up the stack from documented local instructions |

## Acceptance constraints

All resume changes remain student-reviewable. GitHub is optional. Scoring must be rubric-driven, versioned, and clearly not an official ATS score. Each high-risk integration needs authorization, bounded resource usage, logging without sensitive content, and automated negative-path tests.
