---
type: chain
title: slang#9693 — WGSL reorders vertex attribute locations
description: Triaged 11-18; root cause verified; parked on maintainer review of human PR #13736. One-shot recheck fired 11-25: still no review activity; refreshed triage comment; stays parked.
tags: [wgsl, vertex-input, location, parked, webgpu]
---

# slang#9693 — Vertex attribute locations are reordered only when targeting WGSL

- **State (2026-11-18):** OPEN, label `WebGPU` + bot labels `reproduced`, `regression`; no assignee.
- **Trigger:** jhelferty-nv (member) asked the bot to triage via @nv-slang-bot mention (issuecomment-6993736675).
- **Owner:** slang-triager, thread `gh-issue-shader-slang/slang-9693`. No fixer — deliberately.
- **Verdict (triager, receipts verified by me 11-18):** reproduced on master; regression from #5498
  (Nov 2024; earlier #5006 behavior was layout-order). Root cause: WGSL legalizer collapses all user
  semantics to the single name "user_semantic" (slang-ir-legalize-varying-params.cpp:5433) so
  suffix-derived indices collide and get first-fit renumbered; WGSL emitter prints @location from
  those indices (slang-emit-wgsl.cpp:325) instead of layout offsets. Same cause explains ignored
  `[vk::location(N)]` on semantic-bearing fields. Front end (slang-parameter-binding.cpp:2272) correct.
- **Why no fixer:** human PR #13736 "WGSL: vertex input locations follow the varying-input layout"
  (Daedie-git, umbrella #13892 names #9693) already fixes both symptoms — triager built the branch
  locally and verified. Fixer handoff would duplicate it. This mirrors the #8557 pattern (fix in a
  human PR, park on its merge).
- **Triage comment:** issuecomment-6994314556 (nv-slang-bot, 2026-11-18 23:08Z).
- **Recheck (2026-11-25, recheck-9693-12b0, triager report):** PR #13736 still OPEN, no review
  activity since 2026-10-23 (~1-month stall). Triage comment 6994314556 patched in place with a
  refreshed 5-bullet naming #13736 as the pending fix and the stall. No fixer dispatched (fix lives
  in the human PR). Task was deliberately non-recurring — a further check needs a fresh one-shot
  (or the /supervise-issues parked-chain walk) if the operator wants one.
- **Next action:** maintainer review/merge of #13736 (decision owner: maintainers; requested reviewer
  dshreiner-nv as of 11-18). PR's closing keywords do NOT list #9693 — link it on merge.
- **Full triage memo:** [9693-triage-memo.md](9693-triage-memo.md) — archived 11-18; holds the
  approach map (A = PR #13736's emitter-reads-layout; B = seed indices from VarLayout; C ruled out),
  the test surface to watch if a re-fix is ever needed, and related issues (#13892 umbrella, #8388,
  #5933). Read it before any post-stall action.
