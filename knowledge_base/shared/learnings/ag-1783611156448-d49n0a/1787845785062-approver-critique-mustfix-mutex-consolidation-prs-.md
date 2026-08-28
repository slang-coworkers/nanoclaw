---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787841407325-fu1qv9
written_at: 2026-08-27T15:49:45.062Z
---

# [approver/critique-mustfix] Mutex-consolidation PRs: enumerate ALL lock-nesting edges and diff every touched lock, or the challenger under-proves

**Context:** slangpy#1124 "Fix profiler collector ordering races" consolidated 3 collector mutexes (thread_mutex, sealed_frame_mutex, gpu_result_mutex) into one ingress_mutex. WOULD_APPROVE on the fallback tier (CodeRabbit clean/Low; production Claude review absent; Devin timed out). codex DECISION_REVIEW returned must-fix TWICE before approving.

**Symptom:** My first lock-order "proof" asserted "ingress_mutex and gpu_mutex are never held simultaneously" — FALSE. They nest one-way gpu_mutex→ingress_mutex via THREE paths (tick_gpu :1208→:1285; device-close callback :1082→queue_missing_gpu_results :1042; begin_gpu_zone :1135→get_or_create_gpu_context→:1068). I found only two, then missed the third even after being corrected. I also claimed "the diff does not touch queue_missing_gpu_results" — FALSE; the diff changes its append lock (gpu_result_mutex→ingress_mutex).

**Root cause:** For a mutex-consolidation change the load-bearing safety question is deadlock (lock-order cycle) and whether re-locking changes any interleaving. I answered it by assertion ("never simultaneous", "doesn't touch") instead of by enumeration + diff. A conclusion can be right (here: one-way edge → no cycle; co-atomic capture → strictly tighter) while its stated proof is fabricated — the *coherent-and-false* failure. codex verified against source and caught both.

**How to catch it:** On ANY PR that adds/removes/merges a mutex or reorders lock acquisition:
1. Grep EVERY acquisition site of each involved mutex (`std::lock_guard|unique_lock.*<mutex>`), then for each, check what OTHER mutex is acquired inside its scope. Build the directed nesting graph explicitly and cite every edge with file:line. A cycle = deadlock = BLOCK; a consistent one-way order = safe.
2. Grep the DIFF for every lock touched — never say "doesn't touch X" without `grep X pr.diff`. A renamed lock on a shared queue changes the interleaving with every other holder of that lock.
3. When a lock now serializes two channels that used to be independent (here CPU write-index snapshot + GPU-result swap under one ingress cut), write the old-vs-new interleaving: co-atomic capture is strictly stronger than two independent snapshots, so it cannot introduce a new drop.

**Fix:** Challenger now enumerates the full lock graph and diffs every touched lock before writing any lock-safety claim. Ran codex critique to convergence (round 3 approve) — the gate is what forced the enumeration.
