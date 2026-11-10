---
type: chain
description: "Human-filed (pdeayton-nv, self-assigned) 11-05: SPIR-V regression in v2026.21 from #13078 — separately compiled hull/domain give patch field COLOR Location 1 vs 0. P1. PR #14335 is READY @87af7e3bc but BLOCKED: tangent-vector wants the front-end layout to be the only source of truth and (option C, 11-06) a prerequisite PR for global-varying layout, tracked as #14375. Side finds #14366/#14375/#14376 are this chain's bot filings (issue_opened needs no dispatch)."
resource: raw/triage-14334.md
tags: [spirv, tessellation, hull, domain, varying-location, regression]
---

# shader-slang/slang#14334 — hull/domain patch locations disagree (v2026.21)

Dated history (triage, #14335 rounds, side finds, redesign, option C): [[slang/14334-hull-domain-patch-location-history.md]].
New dated entries go to the history file, not here. Triage memo: [raw/triage-14334.md](raw/triage-14334.md).

**Mechanism (triage, 11-05).** `createVarLayoutForLegalizedGlobalParam` (slang-ir-glsl-legalize.cpp:1049) put every leaf,
system values included, into `usedBindingIndex`, so `gl_Position` took slot 0 and the #13078 patch base `getLSBZero()`
returned 1, while the domain side used front-end Locations and got 0. DXC gives Loc 0 on both sides.

## Current state (11-06 22:40Z)

| item | state |
|---|---|
| #14334 | OPEN, P1 regression (`regression`+`reproduced`), pdeayton-nv self-assigned and shepherd. Reporter files and self-assigns routinely (see [#14099](slang-14099-hlsl-sibling-for-loop-redecl.md)). |
| PR #14335 | Non-draft since 11-06 17:32Z (pdeayton-nv), remote head **87af7e3bc**, `Fixes #14334`. **Blocked** by tangent-vector's option C ([6695608888](https://github.com/shader-slang/slang/pull/14335#issuecomment-6695608888)) until the #14375 prerequisite lands. Fixer `sess-1793858928003-n4rvnv`, reached via triager `j75jq7`; Main side is sibling session `o06xef`. |
| local work | 4 unpushed commits: the front end lays out the patch-constant result (`EntryPointLayout::patchConstantResultLayout`); `createPatchConstantFuncResultTypeLayout` and `getVaryingOutputLocationEnd` deleted; `translateGlobalVaryingVar` reverted to master. Per tangent-vector it becomes an `IRAttr` (`IRHullEntryPointPatchConstantOutputLayoutAttr`), not an optional operand. No push until #14375 lands. |
| #14375 | Prerequisite, self-assigned by tangent-vector; staged PRs; see [[slang/14375-global-varying-entrypoint-ownership.md]]. Re-check `recheck-14375-maint-qs-43b4` 11-11 17:00Z. |
| #14366 | Decided 11-06 22:39Z: struct-relative stays; resolved when #14335 lands. See [#14366](14366-patch-field-explicit-vk-location.md). |
| #14376 | FILED-ONLY, parked `advisory:maintainer-decision` (CP-first vs DXC semantic-sorted counter). |
| approver | `ready_for_review` queued in `data/approver-pause-queue.md` at 87af7e3bc5 (approver paused). |
| timers | `recheck-14335-ready-6dd2` and `recheck-14335-ab-choice-9bd7` both cancelled 11-06 (un-draft done; A/B superseded by option C). |

## Decisions and lessons

- **P1 regression ⇒ the un-draft ask goes to the operator at once**, the exception to the weekly ready-flip list. It was
  resolved when the shepherd un-drafted #14335 on 11-06.
- **The maintainer's design rule:** no IR pass numbers outputs or computes offsets; the front-end layout/binding step encodes
  the patch-constant layout and legalize only reads it (tangent-vector, 11-06, 3 inline reviews on slang-ir-glsl-legalize.cpp).
  The same direction probably covers the patch-constant half of [#13427](../imported/project_13427_double_vector_varying_location_count.md).
- **Sequencing (11-06 20:23Z):** #14335 first and owns the hull's use of the front-end layout; #14366 stacks on it with only
  the shared explicit-Location rule. Then option C put #14375 ahead of both.
- **Side finds from this chain are filed without asking** ([filing policy](../orchestrator/filing-verified-issues-policy.md));
  their issue_opened webhooks need no dispatch, and a fixer chain on one needs an operator go — except when a maintainer asks
  for it, as with #14375.
- Relays to the chain's triager go pinned with `in_reply_to=2` (my webhook row), so they don't route back to the sender.

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
