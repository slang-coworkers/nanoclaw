---
name: project_11917_pass_gating_epic
title: slang#11917 — gate backend IR passes that cannot apply (perf epic)
description: "slang#11917 compile-time perf epic (pdeayton-nv): ~55 of ~80 backend passes run unconditionally in linkAndOptimizeIR even when their IR feature is absent. Gate each on a RequiredLoweringPassSet flag via a safe-superset predicate. Batch-3 SHIPPED = PR #12281 MERGED 2026-08-05. Durable lessons: a wrong-INSTANT -dump-ir launders a reasoning error as data; a shallow-scan gate predicate must be a provable SUPERSET of what the pass mutates (else stale-FALSE miscompile); grep -c counts LINES not occurrences; a ruling addressed to one session doesn't bind siblings; Reviewer-A cost blow-up is ARCHITECTURAL (unbounded concurrent subagents), not budgetary — a higher cap buys the same failure."
metadata:
  node_type: memory
  type: project
  originSessionId: d426803e-6b4c-4725-a21a-7ca38bb18994
---

# slang#11917 — gate backend IR passes that cannot apply

**Terminal / historical.** Distilled 2026-08-31 from a 104 KB batch-by-batch chronicle.
Batch-3 MERGED; batch-2 approved-and-awaiting-merge at last reading; the dated dispatch
narrative is pruned. Author/epic-driver: pdeayton-nv.

## The epic

*"Avoid running backend IR passes when they cannot apply"* — compile-time perf on
`RequiredLoweringPassSet` / `linkAndOptimizeIR` (`source/slang/slang-emit.cpp`). ~55 of
~80 backend passes run unconditionally (full-module walks) even when their IR feature is
absent. Each batch gates more passes on a boolean in `RequiredLoweringPassSet`, computed
by a scan in `calcRequiredLoweringPassSet`. Standing guardrails: **drafts-only,
non-closing (`Addresses #11917`), bot flips/merges nothing.**

## Outcome

- **Batch-3 = PR #12281 — ✅ MERGED 2026-08-05 01:43Z** (`ff45b15ed3f0`, merged_by
  pdeayton-nv). Recorded by Main because slang-fixer timed out mid-turn and its session
  couldn't carry it forward. Scope diverged from the triager's recommendation, correctly:
  a shared-worklist per-batch scratch-bit reset in `processModule` (kills the #12040
  quadratic, benefits all framework consumers) + `legalizeEmptyTypes` entry-time early-out;
  `legalizeResourceTypes` **deliberately NOT gated** — the fixer determined a globals-scope
  scan is unsound as a gate (resource legalization rewrites resources reached via function
  signatures/calls/returns/locals, not module-global type insts) and refused to ship an
  unsound-or-valueless gate. pdeayton approved the result. Batch-2 = PR #12336, approved at
  head `23cd9f6d48` (jkwak's comment-removal applied by a sibling), awaiting merge.

## The safe-superset mechanism (the reusable core)

The path OUT of the B/C-risky tail without a shared rescan (which jkwak rejected 07-14):

- **Flag-gate** a pass on a boolean set by the scan — safe only if the trigger is present
  at scan time.
- **In-pass shallow scan at pass entry** (the #11987 reference) — observes current module
  state, so the post-scan-synthesis hazard is structurally absent. This is what unblocks
  passes whose trigger can be synthesized after the last shared scan.
- ⛔ **The gate predicate MUST be a provable SUPERSET of everything the pass mutates.** A
  literal hint that UNDER-covers produces a stale-FALSE **miscompile**: e.g. pdeayton's
  "struct fields + uniform param groups" under-covered `legalizeResourceTypes`, whose real
  trigger is the pass's own `isResourceType` over bare params/locals/arrays/return slots.
  Safe formulation mirrors #11987's `hasAnyMatrixToLegalize`: scan ANY inst satisfying the
  pass's own predicate + conservatively force-run if any unspecialized `IRGeneric` remains.
- **Widening-only changes are monotone** (new `case` labels broadening an existing flag
  false→true, no new flag) — they cannot create a dead flag or skip a needed pass, so they
  are not a defect. It's a defect only when a flag is **DEAD** (covers nothing), not merely
  narrow.

## Durable reasoning lessons

- ⭐⭐⭐ **A wrong-INSTANT measurement is more dangerous than a wrong argument, because a
  `-dump-ir` launders a reasoning error as data.** A dump taken at the wrong pipeline point
  (before vs after the pass that synthesizes the inst) "proves" the opposite of the truth.
  Pin the dump to the exact pass boundary you are reasoning about.
- ⭐⭐ **Every primed instrument delivers its cheap answer** — a confirm-framed subagent
  returned "all four VERIFIED" while one claim was hollow. Framing sets which answer is
  cheap to reach, never whether the reasoning is sound.
- ⭐⭐ **`grep -c` counts matching LINES, not occurrences.** A peer's "only 16 sites" (from
  `grep -c`) was really ~42 lines / 43 occurrences — the undercount objection was itself
  undercounted. See [[feedback_search_code_total_count_is_not_a_file_count]].
- ⛔⭐⭐⭐ **Don't dispatch an in-development draft state as a SHIPPED defect.** The
  `assumeAddress` dead-flag was caught by the fixer *before* publication and never reached
  any remote ref, yet it was relayed to two approvers as shipped — the error was the word
  "shipped," not the finding. And a co-emission "safety-critical" mechanism relayed verbatim
  in two dispatches was later FALSIFIED at HEAD — [[feedback_never_relay_a_verdict_not_in_hand]].
- ⭐⭐⭐ **A ruling addressed to one session does not bind its siblings.** Main ruled
  "reply-only, don't push" on #12281 for one session; a sibling session pushed anyway (same
  shared identity, same branch, no coordination surface). The outcome was benign only
  because the maintainer re-approved — luck, not design. See
  [[feedback_no_double_dispatch_peer_wired]], [[feedback_route_authorizations_through_dispatch_owner]].
- ⛔💰⭐⭐ **Reviewer-A cost blow-up is ARCHITECTURAL, not budgetary.** Two runs died at cap
  ($40.09, then $81.60 on a *smaller* diff), zero recoverable findings, no `final-review.md`.
  `repro.sh` passes a single `--max-budget-usd` to ONE `claude` invocation; six reviewers +
  clarity pass explore concurrently and unbounded, so spend scales with reviewer-count ×
  depth, not diff size, and the cap trips after all have burned tokens and before any
  reporting step. **A higher cap buys the same failure** — the fix is per-subagent budgets,
  not a bigger ceiling. See [[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]].
- ⚠️⭐⭐ **Mid-struct ODR/layout split hazard** (this epic appends to `RequiredLoweringPassSet`
  every batch): a TU compiled 2.4 s after a mid-struct write to `slang-code-gen.h` disagreed
  on struct layout — it still linked, still ran, and every dump looked plausible. A stale
  struct layout is a silent-wrong-data source.

## Related concepts

- [[feedback_drafts_only_guardrail]]
- [[feedback_never_relay_a_verdict_not_in_hand]]
- [[feedback_search_code_total_count_is_not_a_file_count]]
- [[feedback_a_cap_that_is_slack_at_rest_binds_when_the_state_changes]]
- [[feedback_route_authorizations_through_dispatch_owner]]
- [[feedback_no_double_dispatch_peer_wired]]
- [[project_8125_empty_struct_cuda_infllight]]
