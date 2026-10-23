---
type: chain
title: slang#13841 — SPIR-V DebugDeclare should name the variable's real storage
description: "slang-fixer efb8e6 / triager 2zq0tf. DRAFT PR #13872 @ba3211739 (Fixes #13841): DebugDeclare names the real OpVariable / out-inout pointer param instead of a _dbgvar_ copy. Adds Decoration.DebugVarStorage = 910 and module version 38, which COLLIDES with draft #13564 (#13555, noTargetCase = 910, v38) and draft #13425 (#13423, MetalConstantBufferLayout = 910, max 37), so three PRs claim 910. #13842 is parked on the #5398 design call and builds on this PR."
tags: [slang, spirv, debug-info, stable-names, module-version]
---

# slang#13841 — DebugDeclare on real storage

**10-22 16:26Z:** the triager reports draft PR #13872 is open at `ba3211739`. It has 2 new tests, and the full suite
passes 10918/10921; the 3 failures are fp8 CUDA tests that also fail on master. `OpDebugValue` is unchanged, so the
overlap work stays with #13842.

**Collision, checked 16:30Z:** master's max stable id is 909, with module version 37.
- #13872 adds `["Decoration.DebugVarStorage"] = 910` and `k_maxSupportedModuleVersion = 38`.
- Draft #13564 (#13555, fixer `w74ros`) adds `["Decoration.noTargetCase"] = 910` and also sets 38.

Whichever merges second must take 911 (and keep 38 if both land in the same release window, or bump to 39 if a release
ships in between). Both PRs are draft and unreviewed by humans. I told the #13841 fixer to note it in the PR body and
handle it at rebase, not to renumber now.

**10-22 16:32Z:** the #13564 fixer confirmed the collision and found a third claimant, #13425 (`Type.MetalConstantBufferLayout` = 910). Its PR body now carries a merge-order line that says "next free id". I logged it in the [#13423 re-chase log](13423-metal-cb-scalar-layout-rechase-log.md); `rechase-13425-maintainer-e658` (10-24) re-reads master before merging.
**10-22 16:53Z:** #13872 head `54457e374` (comment-only). The Risk section lists the 910 collision with #13564 and #13425. Peer review is running.
**10-22 18:07Z:** peer review R1 at `54457e374` returned REQUEST_CHANGES. R1 is partial: modified non-promotable `in` params keep a `_dbgvar_` copy and lose DebugDeclare at -O1, and the reviewer sent a 4-line remedy. It also found 2 gaps (late-bound entry points via findAndCheckEntryPoint, and the CHECK-NOT window) plus stale comments. The fixer is applying them.
**10-22 22:45Z:** peer review R2 at `5ac1c3cdb` returned REQUEST_CHANGES. A 🔴 regression reproduces at -g2: a dynamic-dispatch generic with an `inout` param hits the new release assert, because `specializeGenericWithSetArgs` leaves a stale DebugVarStorage. Reverse mode also leaves a stale decoration (fails -validate-ir with E40007). All R1 items are fixed. Remedy options: shared post-clone rebinding (the producer-side fix) or a copy fallback. Next review is the last round.
**10-22 23:38Z:** R2 fixes are pushed at `35eac4a`: a shared post-clone rebind helper, plus an emitter copy fallback that -validate-ir flags. 7 PR tests pass; the full suite is 10926/10929 (fp8 CUDA). R3, the last round, is requested. CI run 39871746309.
**10-23 00:33Z:** peer review R3 (last round) at `35eac4a2f` returned APPROVE_WITH_NITS. The R2 ICE and the reverse-mode stale decoration are both fixed and verified; PR tests 15/15, a 4427-test subset and 22 probes are clean. Only test and contract nits remain. Next: the fixer applies the nits and sends the Fix Report to the triager, then human review (shepherd pdeayton-nv).
**10-23 00:55Z:** the Fix Report (head `5c5909334`, 26 files +796/−57, full suite 10927/10930, R3 APPROVE_WITH_NITS applied) reached me instead of the triager. That's the second time today, after #13828. The cause is that I messaged the fixer directly (the 910-collision heads-ups), which skips the triager tier, so the fixer's report-up drifts to me. I forwarded it to triager `2zq0tf`. The PR is a draft and BEHIND master.
**10-23 00:57Z, triage resolved (fixed).** The triager edited bot comment 6345766573 in place. PARKED on pdeayton-nv's review. Webhooks and /supervise-issues cover it.
