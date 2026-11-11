---
type: chain
title: "slang#14375 — entry points do not own the global varyings they use (prerequisite of #14335)"
description: "Bot-filed 11-06 00:10Z by the #14334 chain (side find S1: a global `out : SV_Position` takes a varying Location, so VS/FS disagree). Became #14335's prerequisite when tangent-vector chose option C (11-06 21:07Z) and self-assigned it. Fixer n4rvnv (via triager j75jq7) posted the analysis 6696391551; tangent-vector steered stage 1 (22:40Z, 6697604956): module-membership ownership, staged PRs. Stage 1 is draft #14395 (11-07): R1-R3 reviewed and applied, @94bbcc178 on 11-10 with 'ready for a human reviewer' posted; waiting on tangent-vector (E30629 keep/drop) and a human review. Re-check recheck-14375-maint-qs-43b4 11-11 17:00Z."
tags: [spirv, glsl, varying-location, global-varyings, parameter-binding, prerequisite]
---

# slang#14375 — global varyings and entry-point ownership

Owned by the [#14334 chain](14334-hull-domain-patch-location-mismatch.md) (pre-11-07 dated history:
[[slang/14334-hull-domain-patch-location-history.md]]; stage-1 dated history from 11-07:
[[slang/14375-global-varying-entrypoint-ownership-history.md]], where new dated entries go). Bot-filed by that chain, so its issue_opened needed no dispatch.
Same fixer session as #14335 (`sess-1793858928003-n4rvnv`), reached through triager `j75jq7`; branch `fix/issue-14375`.

## Current state (11-10 05:09Z)

| item | state |
|---|---|
| #14375 | OPEN, self-assigned by tangent-vector 11-06 21:21Z. Prerequisite of #14335 (option C, [6695608888](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695608888)). |
| analysis | [6696391551](https://github.com/shader-slang/slang/issues/14375#issuecomment-6696391551), questions (a) reflection, (b) reachability, (c) stacked vs staged, (d) #13892 overlap. Pointer on #14335 for tangent-vector: [6696405616](https://github.com/shader-slang/slang/pull/14335#issuecomment-6696405616). |
| maintainer steer | tangent-vector [6697604956](https://github.com/shader-slang/slang/issues/14375#issuecomment-6697604956) (22:40Z); bot follow-up [6698074996](https://github.com/shader-slang/slang/issues/14375#issuecomment-6698074996) with 4 more questions. |
| stage 1 | Draft **#14395** (`fix/issue-14375-stage1`, `pr: breaking change`, "Part of #14375"), head **94bbcc178**, pr-mapping → fixer `n4rvnv`. Peer reviews R1/R2 APPROVE_WITH_NITS, R3 REQUEST_CHANGES (small, E30629 scope), all applied. Diagnostics: W30628, E38049, E30629 (SPIR-V/GLSL/WGSL only), W38044. "Ready for a human reviewer" posted [6759534205](https://github.com/shader-slang/slang/issues/14375#issuecomment-6759534205). |
| waiting on | tangent-vector: E30629 keep/drop, then a human review. Ready flip is the maintainers' (no operator ask). Stages 2 (explicit-Location two-phase binding) and 3 (IR `inout`) not started. |
| timer | one-shot `recheck-14375-maint-qs-43b4`, 2026-11-11T17:00Z; its decision table covers the 22:40Z steer. Webhooks deliver replies to the fixer. |

## The problem (fixer's analysis, 11-06 21:35Z)

The earliest failure is in the checker: `EntryPoint::_collectShaderParams` (slang-check-shader.cpp:877-921) never links an
entry point to the global varyings it uses, and `validateEntryPoint` skips them. Parameter binding then numbers globals across
the whole program and ignores their semantics (slang-parameter-binding.cpp:728-735, :1796-1810), and
`translateGlobalVaryingVar` invents layouts. Estimated **~900–1500 lines**, with likely Location and reflection changes.
#13892 (jkwak-work's umbrella; no PR from them, last updated 10-23) and #13622 (global-`in` SV stage check) are related;
they are named in plain text, with no Fixes link.

## Decisions

- **11-06 21:11Z (Orchestrator, msg 67 → triager j75jq7): GO**, because a maintainer asked for it. `Fixes #14375`, same
  fixer session, investigate first, then a draft PR. Handoff 5-bullet: [6695688439](https://github.com/shader-slang/slang/issues/14375#issuecomment-6695688439).
- **11-06 21:35Z (msg 83):** post the analysis with its questions (no @jkwak-work), add a short pointer on #14335 because
  nobody watches #14375, and **build only stage 1** (checker reachability + validation) until the maintainers answer the
  reflection and staging questions. No ready flip, no timer beyond the one re-check.
- **11-06 22:40Z: tangent-vector's steer**, relayed verbatim to triager `j75jq7` (pinned, `in_reply_to=4`, thread
  `gh-issue-shader-slang/slang-14334`; it reached Main on the #14375 thread, session `tf3wbj`):
  - entry points own the global varyings of their declaring module (plus transitive deps), in declaration order, with no
    call-graph walk; per-entry-point layout; reflection keeps a proxy only; staged PRs, not one massive PR;
  - a strong yes to `EntryPoint` keeping an ordered list of its global varyings, and to moving the must-return-`void`
    rule there;
  - a new "no (varying) function parameters" rule, as a warning that says it becomes an error in a future release;
  - module-level checks at top-level module scope only: HLSL source is an error; legacy Slang is a warning ("GLSL dialect
    only"); Slang 2025+ is an error; a marker attribute on `ModuleDecl`.
- The bot follow-up asks about multi-entry-point modules (2 master tests: wgsl/glsl-readonly-buffer,
  cross-compile/geometry-shader-global-array-12169), core/GLSL-module globals, importing a marked module, and the reach of
  the function-parameter warning. The fixer builds the parts that don't depend on the answers. Scope keeps growing, but
  the maintainer leads it.
