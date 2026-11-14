# Verification Evidence

## Baseline run — 2026-11-14

| Command | Result | Evidence |
| --- | --- | --- |
| `frontend: npm run build` | PASS | Vite 5.4.21 transformed 1,571 modules; production assets emitted successfully. |
| `backend: npm test` | INCONCLUSIVE | Initial run exceeded the 30-second execution window after Jest startup. Full suite requires the MongoDB-backed integration fixture referenced by tests. |
| `nlp-service: python -m unittest test_scoring.py test_education_relevance.py test_benchmark_deep.py test_fallback_extraction_audit.py` | BLOCKED | 4 import errors: `ModuleNotFoundError: No module named 'fitz'` under Python 3.15. |
| `backend: npm audit --omit=dev --offline --json` | PASS (offline metadata) | 0 reported production vulnerabilities; 159 production dependencies. |
| `frontend: npm audit --omit=dev --offline --json` | PASS (offline metadata) | 0 reported production vulnerabilities; 33 production dependencies. |

Offline audit is not a substitute for a connected advisory scan. No coverage claim is made.
