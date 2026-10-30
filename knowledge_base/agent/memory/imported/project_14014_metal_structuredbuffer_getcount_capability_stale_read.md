---
type: project
name: project_14014_metal_structuredbuffer_getcount_capability_stale_read
description: "slang#14014 (albertrodriguezclo, external, 10-29): on Metal, StructuredBuffer.getCount() passes the capability check and emits invalid MSL (.GetDimensions on a device pointer); RWSB.getCount / SB.GetDimensions get E36107. Triager's root cause: a stale capability read in processReferencedDecl. Bug half is in draft PR #14024 (slang-fixer u5uhza); the Metal buffer-count feature half is parked on a maintainer design decision, re-check t-bde68e on 11-05."
---

# slang#14014: Metal `StructuredBuffer.getCount()` passes the capability check, emits invalid MSL

**Report.** On `-target metal`, `RWStructuredBuffer.getCount()` and `StructuredBuffer.GetDimensions`
are rejected with E36107. `StructuredBuffer.getCount()` is accepted and emits
`this_0.GetDimensions(...)` on a `uint device*`, which Apple `metal` rejects. The reporter suspected
a missing `[require]` on the `getCount()` extension (hlsl.meta.slang ~29634).

**Triage (slang-triager, 13:35Z; issue comment 6498021806, verified live: `reproduced` + Type=Bug).**
These are the triager's findings:
- Not a duplicate (the generic-interface variant is #13995). Not a regression (the code dates from #5097, 2024-09).
- Root cause: `CapabilityDeclReferenceVisitor::processReferencedDecl` reads the callee's
  `inferredCapabilityRequirements` before running ensureDecl on it (slang-check-decl.cpp:22154).
  The `StructuredBuffer : IArray<T>` witness check visits `getCount` before `GetDimensions` has
  capabilities, so `getCount` ends up with `{}`. RWSB escapes only because its witness is nested
  (skipped at :22954). A user-written copy of the extension is correctly rejected.
- Approach A (recommended) is ensure-before-read in the visitor. It exposes 3 latent core-module
  conflicts (WaveMaskPrefixMin/Max matrix vs :20126, HitObject::GetAttributes :26054) that need
  real fixes. Across 5375 diagnostic runs, the only other change is one new glsl E41012 warning.
- B (`[require]` on the extension) is symptom-only. C is a Metal emit backstop and complementary.
- D, real Metal buffer counts (size table vs `{ptr,count}`), is parked on a maintainer design decision.

**Ownership.** Webhook `issue_opened` 12:40Z → Main `sess-1793277609391-m4ugen` → triager
`sess-1793277707438-o54zwn` → slang-fixer `sess-1793280525303-u5uhza` (branch `fix/issue-14014`,
claimed 13:34Z). There is one session per group on `gh-issue-shader-slang/slang-14014`, verified 13:34Z.

**Fixer progress, 15:23Z (fixer's report).** The fix is built and verified on the L40S, and the
core-module bootstrap is clean. On the first full run the only failures were 3 `fp8-cuda` tests,
which also fail on master. The fix also surfaced an E36104 in the `neural` standard module, which
the triage sweep missed because it built without standard modules. The fixer resolved it by
declaring the NV coop-mat conversion capability on `linearTransform`. The PR is planned as a draft
labeled `pr: breaking change`: `SB.getCount()` on Metal now errors where slangc used to succeed. It
uses `Addresses #14014` (not `Fixes`), so the Metal buffer-count feature request stays open.

**15:41Z: draft PR #14024 is open (verified live).** Head `fix/issue-14014` @8f31746, labeled
`pr: breaking change`, `Addresses #14014`. The pr-mapping goes to fixer session `u5uhza`. The PR fixes
the 3 latent conflicts: WaveMultiPrefix matrix on CUDA, `HitObject::GetAttributes` (native DXR 1.3
kept), and neural `linearTransform`. The fixer reports slang-test 11296/11299; the 3 fp8-cuda tests
also fail on master.

**16:37Z: slang-reviewer R1 on #14024 @8f31746 is APPROVE_WITH_NITS** (0 bugs, 1 gap; Main was CC'd
`combined-review.md`; the fixer got it at 16:37:16Z). The reviewer's audit diffed 19,544 decl
capability sets: 87 changed, all narrowings. The PR also fixes a second silent miscompile:
`Buffer<T>.getCount()` on `-target cpp` used to emit an empty GetDimensions body. `DescriptorHandle`
deref now warns E41012 below sm_6_6. The gaps to fix with no extra review round: G1, the neural
`linearTransform` requirement has no GPU-free test (the reviewer supplied a tested file); G2, the
`Buffer.getCount`/DescriptorHandle narrowings are not pinned or documented.

**17:16Z [Fix Report] (verified live 17:17Z).** #14024 is a draft at head `99c736d`: 8 files, +234/−10,
7 commits. Requested reviewer: jhelferty-nv. All R1 nits are applied; routing
`propagateUserDefinedDerivativeRequirement` through the helper was declined as optional. CI is in the
**priority-yield gate**: `wait-for-human-priority` and `check-ci` failed, `falcor-build-approval-gate`
is waiting, and 93 jobs were skipped. This is the intended gate for a draft bot PR; show it, never nudge
it. Open questions are on the PR: half networks with KHR-only caps under `-restrictive-capability-check`
now get E41013 (neural owners). Possible follow-up, held for the operator (fan-out control): WaveMatch's
GLSL arm emits no `#extension GL_NV_shader_subgroup_partitioned`.

**Resume on:** a maintainer review or comment on #14024 / #14014 (webhook to fixer `u5uhza`). The triager's [Triage Resolution] is still to come. For the feature half, the
triager's one-shot `t-bde68e` runs on 11-05, or earlier on a maintainer comment on #14014.
