# Verification Evidence

## Milestone 0 recovery verification — 2026-11-14

| Command or check | Result | Evidence |
| --- | --- | --- |
| `docker compose -p resumeiq-m0-20261114 config --quiet` | PASS | Final Compose configuration validates, including the private shared `uploads_data` volume for API/worker hand-off. |
| Docker service startup | PASS | MongoDB and Redis health checks passed; API `/api/health` and `/api/ready` returned healthy/ready; NLP `/health` reported internal authentication required. |
| Backend Jest integration and queue suites | PASS | **77/77** tests passed against `mongodb://127.0.0.1:27017/resumeiq_m0_test` and `redis://127.0.0.1:6379`. Covers readiness, ownership, queue failures/retries, document lifecycle, CSRF, quotas, and race recovery. |
| NLP unit/security discovery | PASS | **47/47** tests passed inside the Docker Python 3.11 runtime with PyMuPDF. Covers malformed bytes, protected PDFs, internal auth fail-closed behavior, scoring guards, education/credential checks, and fallback extraction. |
| Live API/worker end-to-end client | PASS (twice) | Cookie registration; malformed PDF `400`; missing CSRF `403`; queued analysis completion via worker; persisted history; private PDF download; CSRF-protected delete; logout; revoked session `401`. |
| Browser check at `http://localhost:5173/login` | PASS | Login app shell rendered correctly. After deliberate authentication burst coverage, the UI presented the expected `Too many requests` error without exposing backend detail; no limiter was weakened to make the browser check pass. |
| `frontend: npm run build` | PASS | Vite 5.4.21 transformed 1,585 modules and emitted the production bundle. |
| `backend: npm audit --omit=dev --json` | PASS | Connected advisory scan: 0 production vulnerabilities (174 production dependencies). |
| `frontend: npm audit --omit=dev --json` | PASS | Connected advisory scan: 0 production vulnerabilities (38 production dependencies). |
| `git diff --check` | PASS | No whitespace errors; Git only reported existing Windows line-ending conversion notices. |

## Observed non-blocking limitations

- The isolated NLP health endpoint had no live Gemini/Groq credentials and ran fallback analysis. This proves safe degradation, not provider-backed output quality.
- The benchmark discovery emits an informational report with 20/25 expected category matches, Spearman 0.833, and five named fixture discrepancies. The report has no failing threshold assertion; do not represent it as a validated production accuracy metric.
- Local Compose shares a named upload volume. A production deployment must replace this with durable, private object storage that is available to independently scheduled API and worker instances.

## Milestone 1 verification — 2026-11-14

| Check | Result | Evidence |
| --- | --- | --- |
| Backend regression | PASS | **84/84** tests, including local/S3 storage contracts, runtime configuration, history authorization, queue recovery, and legacy cleanup. |
| NLP regression | PASS | **47/47** Python 3.11/PyMuPDF tests. |
| Live API/worker E2E | PASS | Upload, queue completion, MongoDB persistence, authenticated download, CSRF deletion, logout, and revocation. |
| Production dependency audit | PASS | 0 production vulnerabilities after adding `@aws-sdk/client-s3`. |
| Frontend production build | PASS | Vite production bundle emitted successfully. |

## Milestone 2 verification recovery — 2026-11-14

| Command or check | Result | Evidence |
| --- | --- | --- |
| Docker Desktop recovery | PASS | Docker Desktop process was absent; starting it normally restored the Linux engine without Compose teardown or volume removal. The isolated `resumeiq-m0-20261114` API, worker, NLP, MongoDB, and Redis services were running; MongoDB and Redis were healthy. |
| `backend: npm test -- --runInBand` | PASS | **84/84** tests passed when run from the host context with the documented isolated MongoDB/Redis test environment. The earlier sandbox `EACCES` was a host-port restriction, not an application failure. |
| Docker NLP discovery | PASS | **47/47** Python 3.11/PyMuPDF tests passed in the recovered isolated Docker stack. |
| `backend: node test_production.js` | PASS | Disposable cookie user registration, malformed-PDF and missing-CSRF negative paths, upload, queue polling, completed result persistence, authenticated private download, CSRF-protected deletion, logout, and revoked session were exercised. |
| `frontend: npm run build` | PASS | Vite transformed 1,587 modules and emitted the M2 production bundle. |
| Production dependency audits | PASS | `npm audit --omit=dev --audit-level=high` reported zero vulnerabilities for frontend and backend when run from the host context. |
| Browser smoke and visual QA | PASS | Host-served Vite was reviewed at 1440px, 768px, and 375px. Landing, register/login, shell, protected-route rejection after logout, and preview disclosure were observed. Lighthouse desktop snapshot scored accessibility 93 and best practices 100. The project owner subsequently confirmed the normal-host manual upload, polling, result/history rendering, private download, deletion confirmation, and logout pass. |
| `git diff --check` | PASS | No whitespace errors; existing Windows line-ending notices are non-failing. |
