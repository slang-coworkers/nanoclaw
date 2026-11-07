---
type: project
name: project_14016_cuda_active_mask_ballot_sync_overhead
description: "slang#14016 (albertrodriguezclo, 10-29): CUDA active-mask over-emits __ballot_sync (4x perf) + a triage-found exit-ballot GPU deadlock. TERMINAL (both drafts): #14025 @63597277a (deadlock + dead-ballot pruning) and stacked #14050 @2c1ce8856 (entry-mask reuse, Fixes #14377), both R1 APPROVE_WITH_NITS; shepherd kaizhangNV; ready-flip pending (weekly list)."
---

# slang#14016: CUDA active-mask synthesis over-emits `__ballot_sync`

Current state, decisions and lessons. The dated log (every message, review and verification receipt) is in
[[project_14016_cuda_active_mask_ballot_sync_overhead_history]]; **append new dated entries there, not here.**

## Problem and triage

- **Report (CONTRIBUTOR, 10-29 12:40Z).** In `slang-ir-synthesize-active-mask.cpp`, once a wave op sits inside a loop, the
  loop condition, every if/else arm, the merge points and wave-op-free inner loops all get `__ballot_sync`, and most
  results are unused. Repro `wave_mask.slang` (4-pass loop, one `WaveActiveSum`): 16 ballots at `-target cuda -O3`.
  Related but not a duplicate: #12847 (duplicate `OpGroupNonUniformBallot`, SPIR-V).
- **Triage (slang-triager ktr6eo, 13:20Z; bot comment 6497786865).** bug P2, CUDA-only IR pass (`synthesizeActiveMask`).
  Not a regression (#1352, 2020). 16 ballots, 3 live; L40S 7.4 → 0.73 ms with a hand edit. **Triage found a GPU deadlock:**
  the `transformChildRegion` early return skips arms that don't reach a mask use, so their exit ballots are never
  emitted, and a following group barrier hangs (shapes `asym2`, `brk2`). Rec A = A1 (complete exit-ballot groups; fixes
  the deadlock) + A2 (region-grouped liveness pruning). The reporter's "drop dead ballots" alone is unsound.

## State (11-06 08:16Z)

| PR | Branch → base | Head | Content | Review | State |
|---|---|---|---|---|---|
| #14025 | `fix/issue-14016` → master | 63597277a (9 commits, +639/−20) | A1 exit ballots on every edge + A2 dead-group pruning; `SLANG_RELEASE_ASSERT` on the region-walk invariant | R1 APPROVE_WITH_NITS (G1–G3 applied) | draft, ready-flip pending |
| #14050 | `fix/issue-14016-merge-mask` → `fix/issue-14016` | 2c1ce8856 | reuse the entry mask at merges of all-normal-exit regions; SpMV 13→5 sites; `tests/cuda/active-mask-if-merge-entry-mask.slang` | R1 APPROVE_WITH_NITS (applied) | draft, ready-flip pending |

Owners: fixer `sess-1793279937673-7qx06k` (pr-mappings for both PRs), triager `sess-1793277757506-ktr6eo` (the
fixer reports to it), shepherd kaizhangNV (assignee + review request). Neither R1 review was posted to GitHub.

## Decisions

- **No separate tracking issue for the deadlock (Main, 10-29).** It is A1 of the same fix and already public in the
  triage comment. A maintainer asking for one overrides this.
- **One PR for A1+A2** (A2 stayed under the few-hundred-line split threshold); A1 is its own commit with
  barrier-after-divergence CUDA tests.
- **Merge-mask reuse ships as a stacked draft (#14050)** on its own branch, never pushed onto `fix/issue-14016`, so
  #14025 does not widen. Ternary/`||` arm re-ballots are live, so A2 correctly keeps them; only #14050 removes them.
- **#14377 (same reporter, 11-06) is folded into #14050** ([slang/14377](../slang/14377-cuda-wave-mask-after-reconvergence.md)).
  The body says "Fixes #14377": the reporter traced the wrong sums to the old `U32_firstbithigh` prelude bug (#13479),
  so the issue is codegen-only and #14050's test pins the codegen.
- **Both PRs stay drafts** ([[feedback_drafts_only_guardrail]]); the ready flip goes on the operator's weekly list, with no
  per-PR asks (orchestrator/undraft-asks-replaced-by-weekly-list.md).

## Open checks

1. kaizhangNV's review of #14025, then #14050.
2. **After #14025 merges:** the fixer retargets #14050 to master. Then check that `closingIssuesReferences` includes
   14377 (it is empty while the base is `fix/issue-14016`). The bot's reply on #14377 promised this.
3. **After #14050 merges** (squash with `PR_BODY`): check that #14377 closed.

## Lessons

- **Every child tier's "parent" edge on this thread resolved to Main, intermittently.** The fixer's [Report]s, pings and a
  file request, and the reviewer's verdicts, reached Main even though all their inbound came from the triager or
  webhooks; the fixer's #14050 [Fix Report] did reach the triager. Hypothesis: the oldest session on the canonical
  thread wins. Main relayed each misrouted report to the triager with `in_reply_to`, named the pattern to the fixer
  once (budget of one), and told the operator (dashboard msgs 61/83/101).
- A `[GATE AUDIT] ... "[Fix Report]" ... codex-critique never invoked` warning on a relay is a keyword false positive
  when the message is not a fix report.
- Hang repros on the shared L40S: count only hangs after kernel launch; pre-launch CUDA context hangs are noise.
  Raise them as infra only if they persist.

11-06 22:54Z triager msg 130 (Main-verified): the reporter backs the design on both PRs (comments 6697788048 on #14025, 6697788672 on #14050, 22:51Z). They want #14025 merged first, then #14050, and offered to re-time the radix sort and rerun the 3 new tests on an RTX 4060 Ti after #14025 merges. The fixer accepted on both PRs (6697808889 / 6697809230, 22:53Z), because the L40S cannot show the per-arm mask at runtime. No change to either PR: #14025 63597277a, #14050 2c1ce8856, drafts, 0 reviews. Still ready-flip pending (weekly list); waiting on kaizhangNV.
