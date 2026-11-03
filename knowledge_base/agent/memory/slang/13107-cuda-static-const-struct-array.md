---
type: chain
title: slang#13107 — static const struct arrays emitted as invocation-local
description: "CLOSED on our side 11-02 — our draft PR #13115 was closed (not merged) in favor of jkwak-work's PR #14204; we confirmed #14204 keeps the CUDA vector/matrix/`half` struct-table regression and posted a repro note there (cmt 6590344457), offering our unpushed `a6d49136b` patch. External codegen-quality bug, P2. No timer."
tags: [slang, cuda, ir, legalize-global-values, static-const, optix]
---

# slang#13107 — `static const` struct tables rebuilt per invocation

Reporter **minco3** (external, NONE): `static const` arrays of POD structs were rebuilt per invocation instead of emitted as
module constants (on CUDA/OptiX, 15.7 KB of per-thread local memory in NanoVDB). Dated history (fix → close, SHAs, comment
ids, inventory numbers, the re-chase series): [[slang/13107-history-triage-to-close.md]] — **new dated entries append there**.

## Terminal state (11-02 22:42Z)

| | |
|---|---|
| Issue | #13107 OPEN, `Fixes`-linked from #14204; thread `gh-issue-shader-slang/slang-13107` |
| Our PR | #13115 (`fix/issue-13107`, head `04d59c59ed`, draft) **CLOSED, not merged**, 11-02T22:12Z by jkwak-work. Never got a CI build (`falcor-ci` gate; the one run expired 10-16) |
| Successor | jkwak-work's **PR #14204** (`e79ef9a595`, same 7 files, non-draft). Our repro note: cmt 6590344457 |
| Unpushed fix | `a6d49136bf` → the fixer's `patches/fix-13107-a6d49136b.patch` (evidence in its `ab-13107/`); offered on #14204 |
| Sessions | `sess-1789513143281-yofko5` (original fixer) `stopped` at $197.19; `sess-1793658702582-irht3p` owns `gh-issue-shader-slang/slang-14204` |
| Timer | none — a jkwak-work reply arrives as a webhook (route to `irht3p`) |

**Reopen on:** a maintainer comment on #13107 / #14204, or an operator ask. The 10-02 design question to tangent-vector /
jkwak-work ((1) land scoped vs (2) bottom-up redesign) and the 10-16 ceiling ask are moot.

## Findings (verified; re-read GitHub before relying on them)

- **Scope is all targets.** `inlineGlobalConstantsForLegalization` runs for HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA/CPU; SPIR-V at
  `-O3` already folds to `OpConstantComposite`, so the difference shows at default opt and `-O0`.
- **Mechanism:** the elements are real `IRCall`s to the synthesized `$init`. #13115 folded them to `makeStruct`, let
  `isSimpleConstantType` recurse into POD struct fields, and added an `IRCall` legality guard; no emitter change.
- **Two regressions in that shape, both still in #14204** (confirmed by build of `e79ef9a595`, evidence
  `/workspace/agent/probe-14204/`):
  1. struct tables with `float2`/`uint3`/`float2x2`/`half` fields become CUDA `__device__` globals that NVRTC rejects as
     dynamic init, because the CUDA emitter writes those leaves as constructor calls (`slang-emit-cuda.cpp:590`);
  2. the blanket `IRCall` guard moves scalar arrays of call results (`{ sqrt(4.0), max(1.0,7.0) }`) from module scope to
     per-invocation on HLSL/GLSL/C++/Metal (it fixes CUDA, where the old dynamic init was rejected).
  `a6d49136bf` avoids both: only `makeStruct`/`makeArray` of scalar literals are newly admitted, and the fold rolls back when
  the table is inlined anyway. A plain `half[2]` array fails NVRTC on base too (pre-existing, separate).

## Lessons from this chain

- **Dedup includes the issue's cross-reference timeline**, not just a keyword search: the reporter's own draft #13109 appeared
  there before ours, and triage missed it.
- **Run a target-output A/B inventory before claiming a codegen fix is side-effect free.** It found both regressions; the
  corpus had 0 tests for vector/matrix/`half` struct tables.
- **`falcor-ci` clears after maintainer engagement**, not infra: of the last 100 deployments (10-13/14 tallies), ~95 % of
  bot-created ones were `waiting`/`error`; the exceptions (#13171, #13378) were approved minutes after a jkwak-work review.
- **A chain parked on an operator budget ask needs a reminder cap.** Nine 48 h reminders drew no reply; the maintainer
  superseded the PR first. Cap the series and park with no timer.
- **Re-fetch a live comment before relaying a webhook body** (bodies are snapshots), and give a re-send to an exhausted
  session's group an explicit `in_reply_to` (msg 163 misrouted).
