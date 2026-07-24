---
name: project_12142_metal_rayquery_trianglefrontface
description: "slang#12142 [Metal] RayQuery TriangleFrontFace emission fix — fork PR, shadow ABSTAIN_POLICY awaiting human CI"
metadata: 
  node_type: memory
  type: project
  originSessionId: d1ebf22b-09c5-41d3-9ace-cc6a0ec886db
---

**slang#12142** — "[Metal] Fix RayQuery TriangleFrontFace emission", author ramang-unity (**fork PR**).

pr_ready_for_review webhook (opened + synchronize back-to-back) → routed to `slang-pr-approver` (shadow mode). Approver decision recorded @ head `2a61c227a2ca` (mode=live):

**ABSTAIN_POLICY / OPEN_GAP.** Fix is source-verified correct — primary github-actions review Clean, Devin exit0 no findings, all 6 clauses pass, 3 🟡 all advisory/cleared. WITHHELD because the validating FileCheck test never executed: fork PR, `CI` matrix `action_required` with 0 jobs, no local Metal execution path (no slangc build / no GPU/macOS). Correct-by-inspection but zero executed validation ⇒ shadow never rounds up on unexecuted codegen.

Correctness basis: aligns table-generated MSL accessors with pre-existing hand-written `is_*_triangle_front_facing` at `hlsl.meta.slang:21842/21863`; non-front-face MSL byte-identical before/after; `strcmp` in meta block proven-buildable (same construct at `:27412`); blast radius nil (no pre-existing Metal test asserts old name).

**Blocker (external):** fork CI is maintainer-gated, not yet approved to run. **Next:** human maintainer approves+runs CI → on merge/close the join records the human verdict against this ledger row. No NanoClaw-side action; chain at rest. Ledger-only, nothing posted to GitHub (shadow).

**07-19 update (cmt 5059977185, jkwak-work):** named reviewer is **@kaizhangNV**, who is at SIGGRAPH this week → **review expected next week (~07-27)**. Pure maintainer-coordination status note; introduces no design point → no re-open, no routing, no GitHub post. Chain stays at rest awaiting kaizhangNV's review/CI next week.
