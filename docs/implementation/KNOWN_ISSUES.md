# Known Issues

1. The active Python 3.15 interpreter lacks required dependencies, beginning with PyMuPDF. NLP tests cannot import the service.
2. Backend integration tests require a running MongoDB instance but no local test database is available/configured. The baseline suite did not finish inside the initial execution limit.
3. Production queue durability is not yet enforceable because the queue module supports an in-memory fallback.
4. Current authentication is bearer-JWT based; cookie sessions, CSRF, verification/reset flows, revocation, and login throttling are absent.
5. There is no organization/tenant model, profile/resume version domain, GitHub integration, private object-store adapter, administration UI, CI, or observability system.
6. UI work must start only after loading Better Design design-system, UI, and UX guidance; no UI implementation was performed during the audit.
