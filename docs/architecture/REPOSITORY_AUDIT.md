# Repository Audit — Milestone 0

**Audit date:** 2026-11-14
**Baseline commit:** `5fba7d6`
**Repository:** `Arjun-coder-ops/ai-resume-analyzer-nlp`

## Repository surface

| Module | Implementation observed | Assessment |
| --- | --- | --- |
| `frontend/` | React 18, Vite 5, React Router, Tailwind, Lucide, Axios; pages are `AuthPage` and `Dashboard` | Single-purpose analysis UI; no product shell or new SaaS domains |
| `backend/` | Express 4, Mongoose 8, JWT, bcrypt, Multer, BullMQ/ioredis, Axios; controllers/routes/models/queue are organized by concern | A useful starting modular boundary, but identity, tenancy, storage, and lifecycle boundaries are incomplete |
| `nlp-service/` | Flask 3, PyMuPDF, requests, Gemini/Groq integration, optional SentenceTransformers, rule/LLM parsing and five-pillar score | Useful scoring logic exists; import/runtime dependency and service-auth hardening gaps block confidence |
| `render.yaml` | API and NLP Render web-service definitions | No worker service, managed cache configuration, frontend service, health/readiness separation, or monitoring declaration |
| tests | Jest API/queue tests plus Python scoring/education/benchmark scripts | Tests are substantial but not reproducibly runnable in this environment |

## Dependency inventory

### Backend production dependencies

`axios 1.13.6`, `bcryptjs 2.4.3`, `bullmq 6.3.8`, `cors 2.8.6`, `dotenv 16.6.1`, `express 4.22.1`, `express-validator 7.3.1`, `form-data 4.0.5`, `ioredis 5.11.1`, `ioredis-mock 8.13.1`, `jsonwebtoken 9.0.3`, `mongoose 8.23.0`, and `multer 1.4.5-lts.2`.

### Frontend production dependencies

`axios 1.13.6`, `lucide-react 0.383.0`, `react 18.3.1`, `react-dom 18.3.1`, and `react-router-dom 6.30.3`.

### NLP declared dependencies

Flask, Flask-Cors, PyMuPDF, requests, Google Generative AI, SentenceTransformers, CPU PyTorch, gunicorn, python-dotenv, Werkzeug, and NumPy. The requirements pin PyTorch to a CPU wheel and configure the PyTorch package index.

## Architecture and code observations

- Auth routes provide register/login/me. Passwords are hashed by the model, but authorization is a bearer-JWT header model.
- Analyses associate uploaded PDFs and job descriptions with one user. Quota accounting, idempotency, retries, worker attempt tokens, and ownership-oriented history access are present.
- Uploads are stored locally; existing history download code is intended to verify ownership before serving a file.
- Express uses JSON/urlencoded limits and a single configurable CORS origin. It does not configure security headers, global rate limits, or CSRF defenses.
- The queue invokes the NLP service and supports Redis/BullMQ plus a local in-memory path. Durable production behavior is therefore not currently guaranteed.
- The NLP service exposes synchronous and asynchronous endpoints, handles PDF parsing and calls back to the API. It treats LLM/embedding availability as optional and relies on runtime environment variables.
- The client has a compact component library but has not established documented tokens, accessibility test evidence, route-level loading/error states, or the broader product IA.

## Technical debt register

| Priority | Debt | Impact | Resolution milestone |
| --- | --- | --- | --- |
| P0 | Nondurable production queue fallback | Lost/duplicated analysis work on restart | 1 |
| P0 | No secure server-side session lifecycle | Session theft/revocation/CSRF risk | 1 |
| P0 | Local upload storage and MIME-only validation | Confidentiality and file-ingestion risk | 1 |
| P1 | No tenant/RBAC model | Cannot safely support universities | 1, 10 |
| P1 | NLP auth fails open when secret is not configured | Internal analysis endpoint exposure | 1 |
| P1 | Scoring benchmark is not runnable locally | Cannot make regression claims | 5 (environment fix immediately) |
| P1 | No CI, contributor setup, or service contract harness | Regressions and onboarding cost | 9 |
| P2 | Current client is analysis-only | Does not meet product journey | 2–8 |
| P2 | No metrics/tracing/readiness/cost evidence | Unknown operational health | 12 |

## Migration safeguards

Preserve `User` and `Analysis` identifiers; use additive schemas and backfills. Keep the present analysis endpoint available behind an adapter while introducing versioned rubric and job records. Add a storage adapter capable of reading legacy local files during development migration, but never expose them publicly. Run migration jobs idempotently, audit every backfill, and provide rollback documentation before destructive data changes.
