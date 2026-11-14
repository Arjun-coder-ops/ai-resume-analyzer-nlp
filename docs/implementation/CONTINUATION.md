# ResumeIQ Continuation State

- **Current branch:** `feat/resumeiq-saas-transformation`
- **Verified M0 checkpoint:** `c5f92bc0f3f941d93c7a563a7b6358ac276f99d3` (`feat: complete ResumeIQ recovery milestone`). Pushed and matched on `origin/feat/resumeiq-saas-transformation` on 2026-11-14.
- **Milestone 0:** complete and remote-verified. Its checkpoint deliberately excludes later M1 work and unrelated existing model/UI/benchmark changes.
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

## M1 completion record

- Introduced a `documentStorage` boundary so history downloads/deletions and newly enqueued jobs use an opaque document key rather than reconstructing paths in controllers.
- Added a validated local adapter, including containment-safe key resolution and focused regression coverage (2 storage tests).
- Added production runtime configuration validation (3 tests): placeholder secrets, HTTP origins, and local-only storage are rejected before the API listens.
- The cloud/object-storage adapter itself is not implemented yet. Production intentionally fails closed rather than treating the Compose volume as durable multi-instance storage.
- The private S3-compatible adapter is implemented with `@aws-sdk/client-s3`; focused document-storage and runtime-configuration suites pass **7/7**.
- **Current external blocker (2026-11-14):** Docker Desktop's Linux engine disappeared during the M1 regression attempt (`//./pipe/dockerDesktopLinuxEngine` was missing). The full backend suite was stopped after waiting for unavailable Docker MongoDB/Redis; NLP discovery could not create its container. Do not count either as a passing or failing M1 assertion.
- **Exact next action:** restore the Docker Linux engine, then re-run the complete backend M0/M1 regression command and the full Python/PyMuPDF discovery command above. Only then run the live E2E, audit/build checks, and prepare a separate M1 commit.
- **Independent checks completed while Docker was unavailable:** frontend production build passed (Vite transformed 1,585 modules); backend `npm audit --omit=dev --json` passed with zero production vulnerabilities after adding the S3 client.
- **Final recovered-engine verification:** backend **84/84**, queue lifecycle **28/28**, NLP **47/47**, and live API/worker E2E all passed. M2 is the next active milestone after the M1 commit/push.

## M2 working checkpoint (2026-11-14)

- M2 is **complete and pushed** as `615f4657bd4b11222b837b0c7cbb4eba494feeb0`. The public landing page, authenticated shell, split-screen authentication, results/history interfaces, and future-module previews are included in that M2 checkpoint.
- This session added the results presentation refinements, accessible workspace tabs and score progress bars, a real authenticated private-PDF download action in history, explicit deletion feedback, and protected preview routes for future modules. Preview routes state clearly that no unavailable service is operating.
- `npm run build` in `frontend/` passed after these changes (Vite, 1,587 modules); frontend and backend production audits both reported zero vulnerabilities.
- Recovery evidence: Docker Desktop had not been running. It was started normally, without a Compose teardown or volume reset. Elevated host access then showed healthy MongoDB/Redis and running API, worker, NLP services; the full backend suite passed **84/84**, NLP passed **47/47**, and `node test_production.js` passed the real API/worker journey.
- Browser recovery evidence: a host-launched Vite server at `http://172.28.112.1:5173/` was reachable by the isolated browser. Browser QA verified responsive public layouts, registration/login/logout/protected routes, dashboard shell and preview disclosure. It found and fixed BUG-017 and BUG-018 below. The project owner subsequently completed the normal-host manual browser upload, results, history, download, deletion, and logout pass successfully.
- **Next milestone:** begin M3 — Master Career Profile. Preserve the established React shell and visual tokens; implement real, versioned profile import/edit/delete workflows rather than prototype behavior.
- Preserve unrelated pre-existing backend/model/NLP and untracked benchmark changes. If M2 is completed later, stage only reviewed M2 frontend/docs hunks and do not overwrite or absorb those files.
