---
type: chain
title: slang#13107 — static const struct arrays emitted as invocation-local
description: External codegen-quality bug, P2. Fix in DRAFT PR #13115 (held), confirmed on-target by the reporter 10-09. Merge is waiting on maintainers picking a direction (tangent-vector 10-02) and on CI, which has never run (falcor-ci deadlock).
tags: [slang, cuda, ir, legalize-global-values, static-const, optix]
---

# slang#13107 — `static const` struct tables rebuilt per invocation

Reporter **minco3** (external, NONE). Canonical thread `gh-issue-shader-slang/slang-13107`.
Owner: **slang-fixer** (branch `fix/issue-13107`, draft PR **#13115**, head `04d59c59ed`).
Assignee and requested reviewer on #13115: **jkwak-work**.

## Facts (verified on GitHub; re-read before relying on them)

- **Scope is all targets, not CUDA-only.** Triage said CUDA/CPU-only; that was wrong.
  `inlineGlobalConstantsForLegalization` runs for HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA/CPU. I
  approved the all-targets fix on 09-15. SPIR-V at `-O3` already folds to a module-scope
  `OpConstantComposite` on master; the difference shows at default opt and `-O0`.
- **Mechanism (fixer's finding, matches my diff read):** the repro's elements are real `IRCall`s
  to the synthesized `$init`, not a `makeStruct` printed as constructor syntax. #13115 folds those
  calls to `makeStruct` and lets `isSimpleConstantType` recurse into POD struct fields, plus an
  `IRCall` legality guard. It makes no emitter change.
- **On-target confirmation (minco3, 10-09, comment 6089817840):** with #13115 on stock 2026.16.1,
  NanoVDB program per-thread local memory drops from 15.7 KB to 48 B. That matches their source
  workaround, with identical VRAM and image output.
- **#13109 was the reporter's own draft PR**, opened 2026-09-15T22:46Z, about 3 h *before* #13115,
  touching the same files (+231/−4). Triage dedup missed it (the triage memo never mentions it), so
  the bot opened #13115 alongside it. minco3 closed #13109 on 10-09T21:48:23Z in favor of #13115.
- **Reporter answered (10-09, comment 6089928651):** the fixer thanked minco3, credited their numbers
  and #13109, and put "planned to merge?" to @tangent-vector and @jkwak-work by name. Branch untouched.
- **Maintainer direction is open.** tangent-vector (MEMBER) proposed on 10-02 (comment 5957480470,
  edited 17:16Z to add a 3rd paragraph): context-sensitive `{}` emit for `makeStruct`, plus a
  bottom-up "`static const`-able" detection. The fixer asked (5957989689) whether to (1) land #13115
  as a scoped step or (2) restructure around bottom-up detection. Still unanswered at 10-09.
- **CI has never run a build on #13115.** Run `35050384991` is parked `waiting` (priority-yielded,
  then `falcor-build-approval-gate` → env `falcor-ci`). The retry workflow no-ops repo-wide because
  `ACTIVE_STATUSES` includes `waiting`: 90 waiting runs on 10-01, 111 on 10-09. I escalated this to
  the operator on 10-01; it's unresolved. The PR is `BEHIND` master.

## Open decisions

1. **Maintainers (tangent-vector / jkwak-work):** option (1) or (2) for #13115. If (2), the fixer
   brings me a rework plan, and I bring it to the operator before the branch changes.
2. **Operator:** the `falcor-ci` CI deadlock, and whether to flip #13115 to ready for the full CI
   matrix.

Re-chase task: `chase-13107-design-direc-1be8` (2026-10-10 17:15Z).

## Lessons from this chain

- Dedup must include the issue's cross-reference timeline, not just a keyword search. A reporter's
  own PR shows up there within minutes of the issue (`#13109` at +1 s here).
- A webhook comment body is a snapshot. Re-fetch the live comment before relaying it (shared
  learning, 10-02).
