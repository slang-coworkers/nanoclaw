---
name: project_slangpy_samples_45_coopvec_parked
description: "slangpy-samples#45 SlangPy 0.41 migration — draft PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0752baea-9f5b-4690-b47a-e94fa4546f78
---

**shader-slang/slangpy-samples#45** — "Complete SlangPy 0.41 migration: experiments/neuralnetwork (coop-vec) + NDBuffer/RWNDBuffer cleanup". Bot-filed (nv-slang-bot) follow-up to #43. Triaged + fixed 2026-07-08 via slangpy-triager (owns fixer edge) → slangpy-fixer. Repo is NOT in the standard webhook routing table — routed to slangpy-triager as the SlangPy samples repo; fit cleanly.

**Net state: chain PARKED.** Draft **PR #50** (`Fixes #45`, branch `fix/issue-45`, `.slang`-only rename) held for coop-vec HW validation. `report_pr_created` confirmed → #50 mapped to fixer session (webhooks route there).

**Verdict (verified against main @ df2a1da):** issue substantially STALE. Merged commit **ba1d3106 "Fix samples" (2026-06-30)**, landed AFTER issue filed (2026-06-16), already resolved 2 of 3 tracked classes:
- Claim 2 (toy-restir `RWNDBuffer<Reservoir,2>`→`RWTensor`, lines 363/408) — done on main. Splatting-file `RWNDBuffer<uint,1>` remnant covered by draft PR #46.
- Claim 3 (Python `NDBuffer` ×8 → `spy.Tensor.empty`) — done on main; zero `NDBuffer` refs repo-wide.
- Claim 1 (coop-vec `experiments/neuralnetwork/neuralnetworks/slang/layers/LinearLayer.slang`) — REAL, the only live item. Rename mapping: `GradOutTensor→DiffTensor`, `.primal.buffer→._primal._data`, `.d_out.buffer→._grad_out._data`, `.d_out.set→._grad_out.add`.

**Blocker (structural):** coop-vec `coopVec*` intrinsic acceptance of new `_data` buffer types + numeric training correctness UNVERIFIABLE without coop-vec-capable HW. NO clean upstream reference — neural-shading-s25#10 migrated `network/*`+`mipmap/*` only, NOT coop-vec (issue's assumption it's a reference is wrong). PR #50 pre-commit CI red is PRE-EXISTING (main itself red — black reformats untouched `.py`); `.slang` change passes all hooks — relayed as fixer's finding, not independently confirmed by Main.

**Gates:** ready-flip/merge gated on operator go AND structurally HW-blocked. codex-critique APPROVE 3/3 stages was the interim gate; peer review (slangpy-reviewer) could not run (no live session, not in destinations) — deferred to maintainer pickup.

**Re-engage only on:** maintainer with coop-vec HW picks up #50, OR human comment on #45/#50 (webhook → fixer session). Re-scope-to-coop-vec-only recommended in verdict comment #4916530824 but left as maintainer call — issue NOT closed. Do NOT re-triage or re-dispatch absent a new human-directed inbound. See [[feedback_verify_report_pr_created]], [[feedback_drafts_only_guardrail]], [[feedback_no_double_dispatch_peer_wired]].
