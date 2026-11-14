# Threat Model — Milestone 0

## Assets

Student resumes, career profiles, credentials, job descriptions, private GitHub metadata/code, sessions, reset tokens, organization data, analysis results, AI-provider credentials, and audit events.

## Trust boundaries

Browser ↔ API, API ↔ MongoDB/Redis/object storage, worker ↔ NLP service, NLP/evidence worker ↔ AI providers, and ResumeIQ ↔ GitHub OAuth/App APIs. Uploaded PDFs and all repository content are untrusted input.

## Risks discovered in the baseline

| Priority | Risk | Evidence | Planned mitigation |
| --- | --- | --- | --- |
| Critical | Client-visible bearer auth model lacks cookie/CSRF/session revocation controls | `authController.js` returns `token` JSON; `authMiddleware.js` accepts bearer header | M1 session subsystem and CSRF tests |
| Critical | Queue can use non-durable in-memory fallback in production | `queue/analyzeQueue.js` documents Redis and in-memory support | M1 production fail-closed queue config and worker split |
| High | Upload validation trusts MIME type and stores on local disk | `uploadMiddleware.js` checks `file.mimetype`, uses disk storage | M1 signature scanning, private storage, retention and malware boundary |
| High | NLP service accepts requests when `INTERNAL_NLP_TOKEN` is unset | `nlp-service/app.py` only rejects mismatches if token is configured | M1 require token at production startup and reject missing auth |
| High | Unrestricted CORS fallback and no security-header/CSP middleware | `server.js` uses `CLIENT_URL || localhost`; no Helmet/header policy | M1 environment validation, allow-list, headers and rate limits |
| High | Error middleware returns raw error messages | `errorMiddleware.js` serializes `err.message` | M1 public-safe error codes, redacted structured logs |
| Medium | Webhook target passed through analysis workflow needs SSRF constraints | queue forwards a configured callback URL | M1 internal service configuration only; prohibit user-controlled callback hosts |
| Medium | No tenant model, RBAC, consent, or audit-event store | only User/Analysis/Quota models observed | M1 organization and authorization foundation |
| Medium | LLM/repository prompt-injection and secret-redaction controls absent | NLP text extraction/LLM integration; GitHub capability absent | M6 boundary, redaction, size/scope limits and adversarial tests |

## Required security validation before release

Authentication/session negative tests, tenant-isolation tests, upload-signature and size tests, webhook authentication tests, authorization tests on every private resource, rate-limit tests, secret/dependency scans, and adversarial repository/prompt-injection tests.
