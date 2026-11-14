# Recovery Bug Audit

## BUG-001 — Completed analyses deleted their own source documents

- **Severity:** Critical
- **Symptoms:** An analysis could complete successfully, while the history download endpoint returned a missing-file response.
- **Reproduction:** Submit a PDF; the worker persists analysis results and then calls `safeUnlink(resumePath)`; request `GET /api/history/:id/resume`.
- **Root cause:** One local upload path was used both as temporary worker input and as the persistent `Analysis.resumeFilename` without a lifecycle boundary.
- **Affected files:** `backend/queue/analyzeQueue.js`, `backend/controllers/historyController.js`.
- **Fix implemented:** Successful and already-completed worker paths retain the file. Deleting an owned analysis removes its contained private file. Failure/orphan paths retain cleanup behavior.
- **Regression tests:** Updated lifecycle test asserts post-completion retention; API consistency test asserts delete removes the file.
- **Verification result:** Verified by the 77/77 MongoDB/Redis-backed suite and live API/worker E2E (history download followed by protected deletion).
- **Commit SHA:** Pending recovery commit.

## BUG-002 — NLP endpoint authentication could fail open

- **Severity:** Critical
- **Symptoms:** With no `INTERNAL_NLP_TOKEN`, callers could access `/analyze` and `/analyze/async` without credentials.
- **Reproduction:** Start NLP service with production authentication policy and no internal token; POST an analysis request without the header.
- **Root cause:** The authorization check rejected only when a server token was present.
- **Affected files:** `nlp-service/app.py`.
- **Fix implemented:** Production authentication is required by default, an absent configured secret returns `503`, mismatch returns `401` using constant-time comparison, and CORS is opt-in for local development.
- **Regression tests:** `nlp-service/test_service_security.py` covers absent, missing, and valid credentials.
- **Verification result:** Docker Python 3.11/PyMuPDF suite passes 47/47, including absent, missing, valid, and protected-PDF request paths.
- **Commit SHA:** Pending recovery commit.

## BUG-003 — Production queue could silently become non-durable

- **Severity:** Critical
- **Symptoms:** Redis initialization/enqueue failures fell back to in-memory processing.
- **Root cause:** The queue used its development fallback regardless of runtime environment.
- **Affected files:** `backend/queue/analyzeQueue.js`, `backend/server.js`.
- **Fix implemented:** Production startup now awaits a usable BullMQ/Redis connection and enqueue rejects when durable delivery is unavailable. Development/test retains the explicit in-memory adapter.
- **Process model:** `RUN_ANALYSIS_WORKER` allows the API and BullMQ worker to run as separate processes; the local Compose stack uses distinct `api` and `worker` services.
- **Regression tests:** 77/77 live MongoDB/Redis-backed tests pass, including queue failure/recovery coverage.
- **Commit SHA:** Pending recovery commit.

## BUG-004 — API could begin listening before MongoDB was ready

- **Severity:** High
- **Root cause:** `connectDB()` was not awaited during startup and terminated the process internally.
- **Fix implemented:** Startup awaits database connection and queue readiness; a readiness endpoint reports `503` while MongoDB is unavailable.
- **Verification result:** API health/readiness and the 77/77 MongoDB/Redis-backed suite pass in the isolated Compose stack.
- **Commit SHA:** Pending recovery commit.

## BUG-008 — PDF validation trusted MIME metadata

- **Severity:** High
- **Root cause:** Multer only checked the client-supplied `application/pdf` MIME value.
- **Fix implemented:** Enforced `.pdf` filename, single-file limit, size limit, and a stored-file `%PDF-` signature check before analysis.
- **Verification result:** Verified by the live E2E client: malformed PDFs return `400` and valid PDFs complete through the queue.
- **Commit SHA:** Pending recovery commit.

## BUG-013 — Daily quota used server-local dates

- **Severity:** Medium
- **Root cause:** quota date keys and reset bounds used local server time, which can differ from user-facing logic.
- **Fix implemented:** Documented and enforced an explicit UTC policy for quota keys and boundaries.
- **Verification result:** Focused date-boundary runtime check passed.
- **Commit SHA:** Pending recovery commit.

## BUG-005 — Deployed SPA could route API calls to its own HTML fallback

- **Severity:** High
- **Root cause:** The frontend fell back to relative `/api` outside development, while Vercel rewrote every path to the SPA entry point.
- **Fix implemented:** Production requests now require `VITE_API_URL`, credentials are included for the session migration path, and the Vercel SPA fallback excludes `/api/*`.
- **Verification result:** Frontend production build passes; no staging deployment credentials are available.
- **Commit SHA:** Pending recovery commit.

## BUG-009 — Browser auth tokens were readable by page JavaScript

- **Severity:** High
- **Root cause:** The frontend stored a bearer token in `localStorage`, making it available to a successful same-origin script injection.
- **Fix implemented:** Authentication now issues an HttpOnly session cookie, keeps a separate readable CSRF token cookie, validates the CSRF header for cookie-authenticated mutations, and invalidates all prior sessions on logout using a version claim. Browser code no longer persists or reads an access token.
- **Compatibility:** Existing bearer-token clients remain temporarily supported while they migrate; CSRF validation applies to the new cookie session transport.
- **Regression tests:** Focused tests reject mismatched CSRF values and accept matching values.
- **Verification result:** Focused recovery suite and the full 77/77 authenticated MongoDB/Redis-backed suite pass. The live cookie-session E2E also verifies CSRF and revocation.
- **Commit SHA:** Pending recovery commit.

## BUG-007 — Fallback gap analysis could label generic prose as missing skills

- **Severity:** High
- **Root cause:** The fallback path tokenized every word-like string in a job description and used only a tiny deny-list.
- **Fix implemented:** A normalized, curated technical requirement extractor now drives fallback matching; generic prose, years, and collaboration language cannot become skills.
- **Regression tests:** Added a provider-failure test asserting Python/Docker/AWS match and Kubernetes is the sole missing technical requirement.
- **Verification result:** Docker Python 3.11/PyMuPDF suite passes 47/47, including the provider-failure fallback regression.
- **Commit SHA:** Pending recovery commit.

## BUG-010 — No API abuse controls

- **Severity:** High
- **Root cause:** No global, authentication, or AI-submission request limiter existed.
- **Fix implemented:** Added global API, registration, login, and authenticated analysis limiters. Production startup now verifies Redis-backed limiter state before listening; development/test can use the explicit in-memory limiter.
- **Verification result:** Syntax and isolated regression verification pass. The connected production dependency audit now reports 0 findings; non-production toolchain findings remain documented in verification evidence.
- **Commit SHA:** Pending recovery commit.

## BUG-011 — Unexpected errors could expose implementation messages

- **Severity:** Medium
- **Root cause:** Global error middleware serialized raw `err.message` for every status, including 5xx errors.
- **Fix implemented:** 5xx responses now use a generic public message while detailed context remains server-side.
- **Verification result:** Full 77/77 HTTP/integration suite passes against isolated Docker MongoDB/Redis.
- **Commit SHA:** Pending recovery commit.

## BUG-012 — NLP PDF extraction had no structural resource limits

- **Severity:** High
- **Root cause:** The request byte limit did not constrain PDF page count or extracted text volume, and malformed documents could produce a generic server error.
- **Fix implemented:** The NLP service now rejects non-PDF bytes, password-protected or empty PDFs, documents over the configured 20-page limit, and text extraction exceeding 200,000 characters. Expected document and request validation errors return `400`; unexpected errors use a generic `500` response.
- **Regression tests:** Added invalid-PDF validation coverage before invoking the parser.
- **Verification result:** Docker Python 3.11/PyMuPDF suite passes 47/47, including invalid bytes and password-protected PDF rejection.

## BUG-014 — Fresh MongoDB startup could fail while reading absent indexes

- **Severity:** High
- **Symptoms:** A new database could reject API startup with `NamespaceNotFound` when index synchronization queried a collection that did not yet exist.
- **Root cause:** `Analysis.collection.indexes()` was called before collection creation on a fresh MongoDB namespace.
- **Fix implemented:** The index synchronizer creates the collection first and treats MongoDB's concurrent `NamespaceExists` result as the expected startup race.
- **Verification result:** The full 77/77 suite passes against a newly created isolated MongoDB test database.

## BUG-015 — Separate API and worker containers lacked a shared private upload store

- **Severity:** Critical
- **Symptoms:** The worker could not read an uploaded document and analyses failed with a missing-document error.
- **Root cause:** API and worker used separate container filesystems despite the asynchronous hand-off.
- **Fix implemented:** Compose mounts the same private named `uploads_data` volume at `/app/uploads` in both services.
- **Verification result:** Live API/worker E2E passed twice through upload, completion, private download, and deletion.
- **Production note:** Named Compose storage is local integration infrastructure only; Milestone 1 must introduce durable private object storage for multi-node production.
- **Commit SHA:** Pending recovery commit.
