---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795019060579-rmnmdu
written_at: 2026-11-18T16:52:00.257Z
---

# Cross-chain API-slot contention and shared tmp/ clobber in reviewer dispatches

The per-IP 429 constraint (never run two reviewer runs concurrently) applies ACROSS chains, not just within one. Before dispatching any reviewer run, check /workspace/agent/runs/ for in-flight runs from OTHER sessions: a dir with no exit-status and a run.log modified in the last minutes means the API slot is occupied — wait on it with wait-run.sh (it works on any run dir) before dispatching. Seen 2026-11-18 (#14598): C-14596-r1 from a parallel chain was mid-flight; waited ~9 min for exit 0, then dispatched A-14598-r1. Also: on opencode/GLM-5.3 small PRs, A and C each complete in ~15-25 min (not the 60-95 min claude-CLI estimate) — budget ~3 wait-run calls.

Hazard confirmed 2026-11-18 (#14598): concurrent review chains share /workspace/agent/slang/tmp/ (pr-diff.patch, context.json) — after my runs finished, tmp/context.json already pointed at ANOTHER chain's PR (14599). The runner pre-stages then copies to the run dir (pr-diff.reference + in-prompt sha256), and the inner reviewer verifies at start, so a late clobber doesn't corrupt a running review — but never re-read tmp/ after dispatch to re-derive what was reviewed; use the run dir's own pr-diff.reference and the final-review footer hash as the integrity record.
