---
type: chain
title: slang#13690 — Metal RayQuery → intersector<> lowering (design question)
description: Human-filed (albertrodriguezclo) Metal design question; routed to slang-triager 2026-10-16
---

# slang#13690 — Metal: lower candidate-free RayQuery to `intersector<>`?

- Filed 2026-10-16 07:31Z by albertrodriguezclo (same reporter as the #13631–#13666 batch).
  Design question, no labels/assignee at filing. Two asks: (1) lower a `RayQuery` whose
  `Proceed()` loop has no candidate handling (and never escapes) to Metal `intersector<>`,
  or add an explicit portable "trace closest hit" API; (2) reuse one `intersection_query`
  across non-overlapping `RayQuery` locals.
- Context: Metal RT pipeline work is kaizhangNV's umbrella #11296 / draft #12691
  ([project_12241](../imported/project_12241_metal_raytracing_part1_tracking.md)).
  Inline RayQuery emit lives in `slang-emit-metal.cpp`.
- 2026-10-16 ~07:35Z: live read clean (open, 0 comments, updated_at == created_at). Dispatched
  to slang-triager on `gh-issue-shader-slang/slang-13690`. Design call belongs to the
  maintainer; no fixer without a go-ahead.
- 2026-10-16 07:47Z `[Triage]` back: feature request, P3, Type=Feature set, no labels. Public comment
  [6210678998](https://github.com/shader-slang/slang/issues/13690#issuecomment-6210678998)
  (verified live: only comment, Type=Feature). The triager's findings (I verified the master emit line
  `slang-emit-metal.cpp:1420` myself; the #12691 claim is theirs): #12691 emits `intersector<>` only
  for the structural pipeline trace and leaves inline RayQuery alone. The reporter's
  `ACCEPT_FIRST_HIT` is dropped on Metal anyway (#13408 / draft #13413). Q1 options are A (explicit
  API, the triager's lean), B (recognition pass, risky because of procedural/non-opaque candidates)
  and C (status quo). Q2 has a working source-level workaround (one `RayQuery<RAY_FLAG_NONE>`
  re-traced); a pass waits on an M3+ measurement. Memo: `/workspace/inbox/a2a-1792136824199-0arit0/triage-13690.md`;
  repro `/workspace/agent/repro-13690/`.
- **PARKED on kaizhangNV** (scope of #11296; A vs B; reuse = pass or doc). No fixer. One-shot
  triager re-check `t-b12d01` 2026-10-23 08:00Z (in the triager's group; `ncl tasks` from Main can't see it).
  Sibling #13688 (same reporter, inline-query tags, same scope question) has its own Main and triager sessions.
- 2026-10-23 08:01Z triager re-check `[Report]`: still parked. I verified it live: 1 comment (ours,
  6210678998), assigned kaizhangNV, label `raytracing`, milestone Q4 2026 (Fall) (all set
  2026-10-19), no design direction. The reporter's #13862 (MERGED 2026-10-22, render-test builds
  the AS for Metal ray queries) is test infrastructure, not a fix. Drafts #13413 and #12691 are still drafts. No post, no
  fixer. Next one-shot triager re-check is `t-dcd79c` at 2026-11-06T08:00Z (in the triager's group).
