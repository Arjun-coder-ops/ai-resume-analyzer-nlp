# ResumeIQ System Design — Milestone 0 Baseline

## Observed architecture

```text
React 18 + Vite SPA
  ├─ Auth context; bearer token stored by client
  ├─ Dashboard, auth, upload, history, results components
  └─ Axios requests
          │
          ▼
Express 4 API
  ├─ JWT auth middleware
  ├─ Auth, analysis, and history routes/controllers
  ├─ Multer local PDF upload directory
  ├─ Mongoose models: User, Analysis, UserDailyQuota
  └─ Analysis queue module ───────► Redis/BullMQ when configured
          │                                  │
          └──────────── local in-memory queue fallback ◄┘
          │
          ▼
MongoDB                              Flask NLP service
                                        ├─ PyMuPDF extraction
                                        ├─ heuristic/LLM parsing
                                        ├─ SentenceTransformers when available
                                        └─ callback/webhook to Express
```

The deployment manifest defines three Render web services (SPA is externally hosted; API and NLP are defined). Redis is configured by `REDIS_URL`; MongoDB and the NLP provider are external dependencies.

## Current feature inventory

| Area | Observed capability | Status |
| --- | --- | --- |
| Accounts | Registration, login, `/me`, bcrypt hashing and signed JWT | Partial; bearer tokens are returned to the browser |
| Resume analysis | PDF upload, quota, async queue, NLP scoring callback, history | Present; depends on MongoDB, Redis/NLP and local upload storage |
| Privacy | Authenticated resume download with ownership checks; public uploads removed | Partial |
| Reliability | Idempotency keys, quota reservations/refunds, retries, stale-job reconciliation | Present in current dirty worktree; needs clean baseline verification |
| NLP | PDF extraction, structured resume extraction, five-pillar scoring, benchmark scripts | Present; dependency environment is incomplete |
| UI | Auth and analysis dashboard built with React/Tailwind/Lucide | Present; no public site, builder, profile, GitHub, organization, or settings flows |
| Operations | Render manifest and `/api/health` | Partial; no explicit metrics, tracing, CI, or documented recovery plan |

## Target evolution

Use a modular monolith for the API, a separately deployed worker, and a constrained NLP/evidence-analysis worker. Planned modules: identity/session, organizations/memberships, profiles, resume documents/versions, analysis/rubrics, GitHub evidence, optimizer, applications, storage, audit/consent, and administration. Cross-module access must receive an authenticated user and tenant context; background jobs must carry immutable job input references, idempotency keys, and trace IDs.

## Data boundaries

Current data is user-owned `Analysis` records plus local files. The target model adds `Organization`, `Membership`, `CareerProfile`, `ProfileRevision`, `Resume`, `ResumeVersion`, `JobTarget`, `Evidence`, `Suggestion`, `Consent`, `AuditEvent`, and `Application`. Every private record receives explicit ownership/organization indexes and server-side authorization.
