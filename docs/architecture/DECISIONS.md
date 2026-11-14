# Architecture Decisions

## ADR-001: Evolve the existing application as a modular monolith

**Status:** Accepted for the transformation.

The existing React/Express/MongoDB/Flask system already has working analysis concepts. The API will become a modular monolith while durable workers remain separately executable. Microservices are deferred until measured scale or independent deployment needs justify them.

## ADR-002: Replace browser bearer-token persistence with server-managed sessions

**Status:** Planned for Milestone 1.

The current controller returns a JWT in JSON and the SPA has an auth context. The SaaS foundation will move to short-lived, HttpOnly, secure cookies with CSRF protection, session revocation, throttling, and account recovery.

## ADR-003: Private object storage replaces local production uploads

**Status:** Planned for Milestone 1.

Local disk is retained only for a documented development adapter. Production uses private object storage with authenticated, ownership-checked retrieval and retention/deletion behavior.

## ADR-004: BullMQ/Redis is required for production asynchronous processing

**Status:** Planned for Milestone 1.

The observed in-memory queue fallback is useful for local development but violates durable production processing requirements. Production startup must fail clearly without Redis, while tests/dev can use an explicit mock adapter.

## ADR-005: Scores and AI claims are evidence-bound

**Status:** Accepted.

Scoring will be versioned and deterministic where possible. Generated improvements are proposals only; no unsupported skill, metric, project, authorship, or achievement may be applied automatically.
