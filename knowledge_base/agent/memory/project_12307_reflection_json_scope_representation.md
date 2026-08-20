---
type: project
title: "#12307 JSON reflection global/entry-point scope representation"
description: "MERGED 2026-08-15/19 (PR #12310). globalScope/scope added to -reflection-json; terminal record + durable lessons distilled from the full chain log"
tags: [slang, reflection, json, merged, terminal]
resource: https://github.com/shader-slang/slang/issues/12307
---

# shader-slang/slang#12307 — JSON reflection scope completeness — MERGED

**State: TERMINAL.** PR #12310 merged by @tangent-vector, merge commit
`56f423ff1a` (2026-08-19T00:48Z); `Fixes #12307` ⇒ issue CLOSED/COMPLETED.
Post-merge housekeeping done (worktree/sentinel/`fix-12307.md` cleared).

## What shipped

`slangc -reflection-json` dropped the implicit `$Globals` constant-buffer / the
parameter-block that wraps a scope — the wrapper's own binding was invisible and
the descriptor slot it consumed showed as an unexplained hole. The fix adds an
**additive** top-level `globalScope` object + per-entry-point `scope` object via a
shared `emitReflectionScopeJSON` routine (mirrors `printScope` in
`examples/reflection-api/main.cpp`), keeps the flat `parameters[]` verbatim for
back-compat, and tags the new additive schema `"version":"1.1"` (absent ⇒ implicitly
`"1.0"`). Self-filed by our bot at @tangent-vector's request off the #11135 review.

## Chain arc (for the record)

design proposal (triaged P2, PARKED) → maintainer approved plan + 2 design
decisions (hand-shaped `globalScope`/`scope`, not var-layout reuse; `version:"1.1"`)
→ DRAFT PR #12310 → reviewer APPROVE_WITH_NITS → polish round → maintainer
CHANGES_REQUESTED (assert, not CYA early-out) → round-2 restructure (net **−21
lines**, deleted provably-dead `"parameterBlock"` kind + nested-`"scope"` recursion,
reachability settled AGAINST the fixer's own earlier "reachable" claim) → maintainer
approved → master-merge + TOC-bot commits auto-dismissed the approval → re-approved
at head → transient Falcor flake (green on master; rerun cleared) → **MERGED**.
Five distinct SHAs across the life of the branch; the reviewable code change was
`e2befa07ef`.

## Durable lessons (the reason this record is kept, not deleted)

- **Assert-vs-handle turns on reachability, and reachability is settled from the
  producer, not asserted by fiat.** A scope's element is *always* a
  `StructTypeLayout` (`ScopeLayoutBuilder::endLayout` → `m_structLayout`;
  `createConstantBufferTypeLayoutIfNeeded` wraps that same struct;
  `spReflectionTypeLayout_getKind` maps a null-`type` group layout to
  `CONSTANT_BUFFER`, never `PARAMETER_BLOCK`). So a scope is exactly {`Struct`} or
  {`ConstantBuffer` wrapping it}; the `default:` assert is correct, not a crash.
  Deleting the two dead branches changed **zero** `.expected` baselines — the proof
  they were dead. (Root-cause the input shape at its producer; see the CLAUDE.md
  methodology.)
- **Draft PRs run no real CI.** `pull_request` CI is skipped while draft;
  `workflow_dispatch` bot runs *yield* (`wait-for-human-priority` + `check-ci` "fail",
  all build+test jobs SKIPPED). "CI green on a draft head" was UNESTABLISHED, not
  pending, for most of this chain. `retry-yielded-bot-ci` is **contention-gated, not
  a timer** — it needs a rerun (mutates the same run id, so `run_attempt` is the
  instrument) and refuses while any `ci.yml` run is active; a yielded run can expire
  un-rerun. The only path to a genuine build is the **operator-gated ready-flip**,
  which fires a fresh `pull_request` run. First real build only came when the PR went
  non-draft (run `31825230417`).
- **"0 skipped" / a green run conclusion never proves a test executed** — only the
  per-test `PASSED` line does. (Same doctest trap as [[slang/rhi-787-cuda-vulkan-shared-sync.md]].)
- **A green re-approval does not override a red build**, and an approval is
  auto-dismissed by any commit landing after it (master-merge, TOC bot) ⇒ block flips
  to REVIEW_REQUIRED, not a failing gate.
- **External lane triage:** the one red lane was `test-falcor / Test (Falcor)` — an
  external NVIDIA-pipeline failure, transient (green on master head SHA read directly;
  `gh run list --branch master` returns stale runs because master CI is `merge_group`,
  not push). `-reflection-json` has no causal path to a Falcor render failure.
- **A figure you can't re-derive on demand is worse than no figure** — a combined
  `slang-test` run swept in unrelated tests ("130/130"); replaced with the exact
  re-derivable count. A two-dot diff shows master-side changes as your own.
