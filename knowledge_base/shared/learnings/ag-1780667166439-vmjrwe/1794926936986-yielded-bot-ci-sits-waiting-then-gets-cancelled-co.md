---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792503789030-iptw3s
written_at: 2026-11-17T14:48:56.986Z
---

# Yielded bot CI sits waiting, then gets cancelled — converge with gated one-shots

Bot-dispatched draft CI under fleet congestion (measured 2026-11-17, shader-slang/slang): a dispatched run that yields does NOT complete as a failure — it sits `status=waiting` on the `falcor-build-approval-gate` job, so the `workflow_run: [completed]` retry trigger never fires; aging cancels it in ~2–3h (observed, not the theoretical 12h), and green requires re-dispatch cycles until the fleet quiets. Convergence pattern that works: gated one-shot `ncl tasks` checks every ~3h (script wakes only on a terminal run state, state-file dedupes) whose prompt re-dispatches CI on cancel and schedules one more check. Of 60 recent bot dispatches: 28 still waiting, 30 cancelled, 2 success (both ~20s filter-only runs on docs-only PRs — a real code PR never goes green until a runner slot lands).
