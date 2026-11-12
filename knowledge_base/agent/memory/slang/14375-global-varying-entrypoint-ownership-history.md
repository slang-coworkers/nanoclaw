---
type: chain-log
title: "slang#14375 — dated history (stage-1 draft PR #14395)"
description: "Dated readings of the #14375 chain from 11-07: stage-1 draft #14395 opened, peer reviews R1-R3 and their fixes, tangent-vector's answers to Q1-Q4 and the -entry fsMain / W38044 / E30629 questions, side finds #14397 and #14434. Current state lives in the chain record; new dated entries append here."
tags: [spirv, glsl, varying-location, global-varyings, parameter-binding, prerequisite]
---

# slang#14375 — dated history (stage 1, draft #14395)

Chain record (state table, decisions): [[slang/14375-global-varying-entrypoint-ownership.md]]. Owning chain:
[[slang/14334-hull-domain-patch-location-mismatch.md]]; its pre-11-07 history is
[[slang/14334-hull-domain-patch-location-history.md]]. These entries were moved out of the #14334 chain record on 2026-11-10,
when it neared 16 KB; they are about #14375's stage-1 PR, so they live with #14375. New dated entries go **here**.

**11-07 01:21Z — stage 1 is up as draft PR #14395** (checked live): branch `fix/issue-14375-stage1`, head 3065810ca, 18 files +533/−67, **`pr: breaking change`**, "Part of #14375" (no Fixes link), pr-mapping → fixer
`sess-1793858928003-n4rvnv`. Module-membership ownership + `validateEntryPoint` checks + 5 new diagnostics; module-scope varyings are rejected in HLSL and Slang 2025+, as are namespaced varyings and imports of modules that contain them (precedent #13728).
Layout and IR are unchanged. The fixer reports the Debug suite at 11906/11909 (fp8). A peer review by slang-reviewer is pending. Q4 (reach of the function-parameter warning) blocks merge. I approved deleting the superseded `fix/issue-14375` @83f6b616e (no PR); its SHA is
recorded on the issue status. The ready flip is pending, for the weekly list or the maintainers.

**11-07 02:35Z — #14395 R1: APPROVE_WITH_NITS, 0 bugs / 6 gaps** (reviewer session `sess-1794014808093-j1g1n8`; file [raw/combined-review-14395-r1.md](raw/combined-review-14395-r1.md); the verdict and a tested patch went to the fixer).
Top concern: under module ownership, #14375's own vs+fs repro no longer compiles its fragment entry point (E58001 + E30702), yet the PR says Q1 adds "no new diagnostic". The fixer re-asks Q1 with the repro.
Other gaps: `inout` globals are validated in+out but lowered out-only; stale `11-language-version.md` + `entrypoint-validation.md`; untested implicit-2025 / `__include` / W38044 exemptions.
The reviewer sent a side find (GLSL `depth_greater` / `layout(triangles) in`) labeled "under the 2026-10-30 hold, do not file". **That hold was superseded 10-31.** I told triager j75jq7 to reproduce, dedupe and file it if verified (msg 107),
and gave slang-reviewer its one correction (msg 109). If the reviewer keeps citing the hold, report it to the operator; do not name it to the reviewer again.
**02:39Z — the R1 side find is filed as #14397** (checked live: bot-filed, `reproduced`, filed only). The GLSL front end rejects geometry, tessellation and conservative-depth `layout` qualifiers with E31216/E31217. Related: #12655/#13033 and bot draft PR #14275 (local_size/early_fragment_tests).
Its issue_opened needs NO dispatch. slang-reviewer acknowledged the hold correction (msg 122) and updated its memory.

**11-07 03:08Z — R1 applied to #14395** (checked live): draft, head **38243ae99**, fast-forward. Declined: the "Breaking changes avoided" table remark (version policy) and the unverified `loadModule` claim. Fixer reports PR + neighbour tests 61/61 and the full Debug suite 11915/11918 (fp8).
Explanation comment 6700240768 is refreshed. **Q1 is critical:** under module membership the #14375 repro itself (vs+fs in one module with module-scope `out`s) regresses: `-entry fsMain` and a whole-module compile fail with E58001+E30702, while master compiles all three forms.
The fixer re-asked with the repro ([6701407273](https://github.com/shader-slang/slang/issues/14375#issuecomment-6701407273)). **#14395 must not leave draft before tangent-vector answers Q1** (error vs legacy-Slang warning for mixed-stage modules).
Parked on tangent-vector (Q1–Q4); webhooks plus `recheck-14375-maint-qs-43b4` (11-11) cover it. Stages 2–3 not started.

**11-09 23:05Z — tangent-vector answered stage-1 questions 1–4** on #14375 ([6753868655](https://github.com/shader-slang/slang/issues/14375#issuecomment-6753868655)).
Stage 1 is draft **#14395** (`fix/issue-14375-stage1`, head 38243ae99, pr-mapping → fixer `n4rvnv`). Their answers:
- module-level checking gives a warning when a module has global varyings and more than one `[shader]` function;
- composed-program checking gives an error, unconditionally, when two entry points come from the same module and that module has global varyings;
- core-module builtins are handled in IR only;
- Q3 is an error;
- the varying-parameter rule applies only in modules that declare global varyings, and uniform parameters stay allowed.

They also asked the bot to state where and when each diagnostic fires. I relayed the comment verbatim to triager `j75jq7` (pinned, `in_reply_to=42`, thread `gh-issue-shader-slang/slang-14334`). The chain had been idle since 11-07 03:08Z.

**11-09 23:45Z — R2 on #14395 is pushed** (checked live): draft, head **2792441f5**. tangent-vector answered Q1–Q4 in [6753868655](https://github.com/shader-slang/slang/issues/14375#issuecomment-6753868655) (23:05Z): the strong overlap check stays per-program on purpose, and a module-level warning is reasonable.
Bot reply [6754526232](https://github.com/shader-slang/slang/issues/14375#issuecomment-6754526232) lays out each diagnostic: W30628 is a module-level warning for global varyings plus 2+ `[shader]` functions; E38049 fires at program layout when 2 entry points come from such a module. Q2–Q4 needed no code change.
**One open question to tangent-vector:** does per-entry-point validation keep module ownership? Today `-entry fsMain` on the #14375 repro fails with E58001+E30702. The PR stays a draft until the answer. Peer review R2 is requested; CI run 42722687240; the fixer reports 11917/11920 (fp8).
The maintainers answered, so `recheck-14375-maint-qs-43b4` (11-11) will hit case (a): record only.

**11-10 00:00Z — tangent-vector on the `-entry fsMain` case** ([6754813607](https://github.com/shader-slang/slang/issues/14375#issuecomment-6754813607)),
replying to the bot's detection table for #14395 (6754526232):
- E58001 and E30702 are both valid to diagnose.
- Relaxing something to a warning is OK only if (1) Slang allowed it before and (2) allowing it needs no downstream checks.
- Goal: anything the front end does not reject must compile with no varying-related back-end errors or ICEs.

Relayed verbatim to triager `j75jq7` (pinned, `in_reply_to=54`). #14395 is still a draft at 2792441f5.

**11-10 00:46Z — #14395 R2: APPROVE_WITH_NITS, 0 bugs / 6 gaps** (file [raw/combined-review-14395-r2.md](raw/combined-review-14395-r2.md); the verdict and a tested nits patch went to the fixer; nothing posted). All of tangent-vector's 6753868655 answers are met.
Top concern: the docs and Risk line understate the new errors. Legacy Slang and GLSL also hit E38208 when importing a user GLSL module, and several `.slang` files on one slangc command now count as one module. Other gaps: E38049 repeats once per target; `inout` is treated as input but never lowered as one;
a dead `CHECK-NOT`; W30628 and entry-point discovery disagree about which functions can become entry points. No side finds. Next: the fixer applies the nits; the draft waits on tangent-vector's `-entry fsMain` answer (6754526232).

**11-10 01:08Z — R2 applied** (checked live): draft at **4d2a0d6d3** (5 fast-forward commits: W30628, E38049, new **E30629**, which rejects a user semantic on a module-scope varying and was E49999 on master; plus the R2 patch and docs). tangent-vector confirmed in [6754813607](https://github.com/shader-slang/slang/issues/14375#issuecomment-6754813607) that E58001/E30702 stay errors.
Open question to tangent-vector: can W38044 stay a warning? The catch is that an explicit `layout(location=0)` global moves to Location 1 when the entry point has varying parameters, on master too; asked in [6755918550](https://github.com/shader-slang/slang/issues/14375#issuecomment-6755918550).
Not filed separately (the triager's call, which I agreed with): the explicit-Location override is stage 2 of #14375, and IR `inout` being output-only is stage 3. **Before the ready flip:** a peer review of the commits after R2, starting with E30629, which only codex has reviewed (msg to triager).
Fixer reports 11924/11927 (fp8); CI run 42733364480. Next after the answer: the fixer proposes the reflection-proxy shape before stage 2.

**11-10 03:20Z — tangent-vector: "basically aligned on the plan"** ([6758025498](https://github.com/shader-slang/slang/issues/14375#issuecomment-6758025498)).
- W38044 stays a warning, because it works on top-of-tree today.
- An explicit `layout(location)` on a global varying must be respected. That needs per-entry-point two-phase binding over
  global varyings, parameters and the result.
- W30628 stays a warning; E38049 is OK.
- User-defined semantics on globals: the IR layout should become the source of truth, and the downstream passes can be fixed later.
- Ask: tell them when #14395 is ready for a human, **after enough self-review rounds**.

Relayed verbatim to `j75jq7` (pinned, `in_reply_to=64`). #14395 is still a draft at 4d2a0d6d3. The ready-flip goes to a human, not the bot.

**11-10 03:28Z — replied to tangent-vector's 03:20Z comment** ([6758120339](https://github.com/shader-slang/slang/issues/14375#issuecomment-6758120339)). Two-phase binding (explicit Locations first, then first-fit, per entry-point unit of globals, parameters and result) is stage 2, not #14395. E30629 is a temporary guard until stage 2; keep it or drop it is asked of tangent-vector.
W38044 and W30628 stay warnings; E38049 stays an error. #14395 is still a draft at 4d2a0d6d3, with a clarity pass running (no behaviour change). Then: full suite, push, a peer review of every commit since R2, the "ready for a human reviewer" post on #14375, and a human flips the draft.

**11-10 04:42Z — #14395 R3: REQUEST_CHANGES (small), 0 bugs / 8 gaps / 3 questions** at 5447ca14b (file [raw/combined-review-14395-r3.md](raw/combined-review-14395-r3.md); verdict and tested patch to the fixer).
B1: E30629 rejects user semantics on module-scope varyings for every target, but master compiles them correctly for HLSL and Metal. Only SPIR-V/GLSL fail, and WGSL emits invalid code. The patch limits E30629 to SPIR-V/GLSL/WGSL, and HLSL/Metal output matches master byte for byte. The clarity pass changed no output (540 commands, 0 differences).
**The bot told tangent-vector something false in 6755918550 ("fails everywhere").** I told the triager the correction must be a visible new comment, not an edit in place (msg after 140).
Side find, relayed correctly without "do not file": cuda/cpp segfault (rc 139) on any module-scope varying, on master b85caf928. The triager will reproduce, dedupe and file it.
**04:44Z — R3 side find filed as #14434** (bot, `reproduced`, filed only): CUDA/PTX/C++ segfault (rc 139) on any module-scope `in`/`out`; Debug builds hit `SLANG_ASSERT(globalParam)` at slang-ir-collect-global-uniforms.cpp:267. Its issue_opened needs NO dispatch (webhook arrived 11-10; still unassigned; not dispatched). The visible correction comment on #14375 is with the fixer, to be posted after the R3 fixes.

**11-10 05:09Z — #14395 R3 [Fix Report]** (checked live): draft at **94bbcc178**, 32 files +1257/−108. Commits: the R3 E30629 remedy verbatim (296573482; it now fires in `validateEntryPoint` for SPIR-V/GLSL/WGSL only), then comment, test and doc fixes.
The doc fix adds a "Module-scope varyings" user-guide section. The 3 commits after the remedy change only comments, tests and docs; codex approved them, the peer reviewer did not re-review. The gate I set (peer review of E30629) is met, because R3 reviewed it.
The visible correction is posted as [6759534205](https://github.com/shader-slang/slang/issues/14375#issuecomment-6759534205) and ends with "ready for a human reviewer"; 6755918550 and 6758120339 now open with correction notes. The fixer reports 11931/11934 (fp8); CI run 42759400774.
**Ready-flip pending:** tangent-vector asked to be pinged when #14395 was ready (6758025498), and that is now done. The maintainers flip it; no operator ask. Waiting on tangent-vector: the E30629 keep/drop call, then a human review.
The explanation HTML (r3b) went to Main as a file (/workspace/inbox/a2a-1794287356468-ncfocc/).

**11-11 17:00Z — `recheck-14375-maint-qs-43b4` fired: case (a), record only, nothing posted** (checked live).
tangent-vector answered (a)–(d) of 6696391551 at 11-06 22:40Z ([6697604956](https://github.com/shader-slang/slang/issues/14375#issuecomment-6697604956)): (a) keep the globals in program-scope reflection as compatibility data only; (b) no reachability, ownership is module membership; (c) no strong preference, stacked by default; (d) this work comes before #13892.
The bot replied at 23:10Z (6698074996), and draft #14395 followed at 01:20Z 11-07. Since 11-06 21:41Z there are no comments, reviews or review comments on #14335.
`gh pr list --head fix/issue-14375` returns `[]`, because stage 1 is on `fix/issue-14375-stage1` (#14395: draft, OPEN, @94bbcc178, last updated 11-10 05:07Z).
Nobody has commented on #14375 or #14395 since the 11-10 05:07Z "ready for a human reviewer" post (≈36 h). The chain waits on tangent-vector's E30629 call and a human review. No timer is set; webhooks cover it.
