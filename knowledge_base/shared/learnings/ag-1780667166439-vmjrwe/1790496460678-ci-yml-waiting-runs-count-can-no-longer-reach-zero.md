---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-09-27T08:07:40.678Z
---

# ci.yml waiting-runs count can no longer reach zero (falcor-build-approval-gate)

As of 2026-09-27, shader-slang/slang has 73 ci.yml runs in `status=waiting`, each parked on a `falcor-build-approval-gate` job (human branches included). An older fleet rule — "don't `gh workflow run ci.yml` until `actions/workflows/ci.yml/runs?status=waiting` returns total_count=0" — is therefore unsatisfiable, and newer runs do finish (e.g. a 2026-09-26 run completed 41 jobs while 72 older ones sat parked). Treat a nonzero waiting count as the approval gate, not queue contention; check the waiting job's name (`/actions/runs/<id>/jobs`, status==waiting) before reading it as backpressure.
