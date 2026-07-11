---
name: project_11917_fixer_compaction_loop
description: slang-fixer
metadata: 
  node_type: memory
  type: project
  originSessionId: d426803e-6b4c-4725-a21a-7ca38bb18994
---

**Incident 2026-07-11:** slang-fixer's #11917 batch session `sess-1783026484565-avmy9m` (agent-group ag-1780667166439-vmjrwe, thread gh-issue-shader-slang/slang-11917, created 2026-07-02 — **9 days old, carries the entire epic history** #11920→#11961→#11987→profiling→desync-incident) entered a **compaction thrash loop** and cannot make forward progress.

**Read-only evidence (ncl sessions messages, no fixer contact):** last substantive output = seq 119 (#11961 MERGED report, 07-10 00:38, BEFORE the 12-pass batch dispatch). Since: seq 121/123/125/127/129 = FIVE consecutive "Context compacted" (865–915k tokens each) over ~30 min, ZERO work product. THREE inbounds swallowed unprocessed into the loop: triager re-anchor (114), lowerReinterpretOptional add (116), #11987 webhook (118, pdeayton asking about shallow scan). Reading (b) thrash-loop confirmed over (a) legitimately-heavy.

**Root cause:** 9-day session accumulated too much epic history; every wake spends the turn compacting. Will NOT self-recover; waiting burns ~865k/cycle every ~10 min.

**Fix = restart fixer with fresh context** (precedent: [[project_taskless_fixer_review_cc_loop]] `ncl groups restart`). CAUTION: fixer group has ~6 OTHER healthy in-flight sessions (12052/12054/12058/12059/12060/11798) that must NOT be disrupted — blast-radius question. `ncl groups restart help` is itself admin-approval-gated (triggered an approval card on Main 07-11). Lifecycle lever is operator's.

**Plan:** (1) triager sends stuck session NOTHING further (told, msg 115) — more messages worsen the loop; (2) operator restarts fixer (escalated); (3) triager fires a TIGHT clean re-dispatch AFTER restart — full authorized scope (12 passes + lowerReinterpretOptional tightening, correctness-trace-absolute, dedup/check-special, position-trap framing, draft-only/report_pr_created, B/C pair parked) in ONE compact message so the fresh session starts lean, NOT inheriting 9 days. Triager prepping, holding to fire on restart-confirmed.

**No GitHub artifact at risk** — batch is draft-only + triager verifies every PR at report. See [[project_11917_pass_gating_epic]], [[feedback_route_authorizations_through_dispatch_owner]].
