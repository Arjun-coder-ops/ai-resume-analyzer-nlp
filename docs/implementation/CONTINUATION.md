# ResumeIQ Continuation State

- **Current branch:** `feat/resumeiq-saas-transformation`
- **Latest prior local commit:** `6aeda9e` (`docs: record ResumeIQ milestone 0 audit`); it has not yet been confirmed on the remote.
- **Milestone 0:** verified locally on 2026-11-14; commit/push is pending an intentional staging review because the worktree contained unrelated pre-existing changes.
- **Docker project:** `resumeiq-m0-20261114`. It is isolated from other Docker projects. Do not run `down -v`; that would remove the test database and upload volume.

## Reproducible verification commands

```powershell
# Backend (live isolated MongoDB + Redis)
$env:NODE_ENV='test'; $env:MONGO_URI='mongodb://127.0.0.1:27017/resumeiq_m0_test'; $env:REDIS_URL='redis://127.0.0.1:6379'; $env:JWT_SECRET='resumeiq-m0-test-secret-please-replace'; $env:INTERNAL_NLP_TOKEN='resumeiq-m0-test-internal-token'
npx jest tests/health.test.js tests/api_consistency.test.js tests/queue_lifecycle.test.js tests/recovery_safety.test.js --runInBand --detectOpenHandles --forceExit

# NLP (supported Python/PyMuPDF runtime)
docker compose -p resumeiq-m0-20261114 run --rm -T -e NLP_LOAD_EMBEDDINGS=false -e REQUIRE_INTERNAL_AUTH=true -e INTERNAL_NLP_TOKEN=resumeiq-m0-test-internal-token nlp python -m unittest discover -v

# Live API/worker journey
$env:API_URL='http://127.0.0.1:5000/api'; node test_production.js
```

## M0 results

- Backend: 77/77 passed.
- NLP: 47/47 passed.
- E2E: passed twice, including malformed-PDF/CSRF failures and successful queue lifecycle, private download, deletion, logout, and revocation.
- Frontend production build and connected runtime audits: passed; both audits report zero vulnerabilities.

## M1 starting point

Replace Compose-local upload sharing with an object-storage abstraction, retain the local development adapter, add retention/cleanup policy, and keep all M0 tests passing. Live LLM credentials and benchmark calibration are not part of M0 acceptance.
