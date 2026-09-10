---
name: project_11847_pr_board_sync_protected_path_abstain
description: "#11847 PR board sync — TERMINAL: maintainer self-merged; approver ABSTAIN_POLICY (protected-path clause dominates)"
metadata: 
  node_type: memory
  type: project
  originSessionId: fc4dcf16-bfe4-49e3-a239-ea18e4f1e097
---

shader-slang/slang#11847 "PR board sync: deliver CI/check + status/review events, co-assign community authors" (author jhelferty-nv, maintainer).

**TERMINAL 2026-07-17.** Self-merged by author-maintainer jhelferty-nv @2026-07-17T01:08:40Z (merge `5c30d437`), during our ~8-day teardown gap. Human review chain DID exist on GitHub: jkwak-work **APPROVED** @2026-07-16T22:27:43Z + coderabbitai comments — correcting my earlier "no human review existed" framing.

**Approver decision (shadow, ledger-only, mode=historical, head `273f5583`):** `ABSTAIN_POLICY / CLAUSE_FAIL:no_protected_paths`. All 16 changed files under `.github/**` (protected glob, v0-shadow-relaxed).

**Reusable lesson — clause precedence:** the Step-1 deterministic `no_protected_paths` FAIL is independently terminal and PRECEDES review-doc-dependent steps. So a missing review doc / GraphQL-401 / stood-down pipeline are NOT the operative cause — even a healthy pipeline ABSTAIN_POLICYs here. When I suggest a verdict to the approver (I suggested ABSTAIN_INFRA/NO_REVIEW_SIGNAL), deterministic policy clauses dominate infra/no-signal reasons. Same protected-path pattern as [[project_11957_cuda_prelude_vec1_make_protected_path]]. Vindicated hold: human_verdict=APPROVED stamped onto ledger row.

**Recovery incident:** reviewer session torn down Jul 9, resumed Jul 17; all A/B/C reviewer artifacts GC'd over the gap (Devin B finished then out-dir emptied; A/C mid-run). REST via gateway works; only GraphQL 401 ([[project_github_actions_graphql_401_outage]], operator-owned re-auth). Stood down rather than spend ~$40-60 on a moot post-merge historical re-review.
