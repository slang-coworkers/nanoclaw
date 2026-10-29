---
type: project
name: project_13579_generic_struct_capability_outside_entrypoint
description: "slang#13579 (kaizhangNV): [require(...)] on a GENERIC struct not enforced outside entry-point signatures. Draft PR #13616 (bot, Part of, DIRTY, behind master 88). 10-28: author removed the fork RT traversal and asked the fix to re-enable 4 fork test runs (incl. intrinsic MLAS + stage-view cases); routed to slang-triager."
metadata:
  node_type: memory
  type: project
---

# slang#13579 — generic struct capability requirement missed outside entry-point signatures

**Report (maintainer-filed, already reproduced + labelled).** `[require(metal)] struct MetalOnly<let N:int>`
used as `uniform MetalOnly<3> input;` and passed to `read<T>(T)` from a compute `main` compiles clean for
`-target hlsl` (expected E36107). Non-generic form errors correctly. Labels: `bug`, `Missing Diagnostic`,
`reproduced`, `Capability System`. Author's analysis: `SemanticsDeclReferenceVisitor`
(`slang-check-decl.cpp`) only calls `processReferencedDecl()` for `DirectDeclRef`; a `GenericAppDeclRef`'s inner
`StructDecl` requirement is never collected. `collectGenericStructTypeUses()` (`slang-check-shader.cpp`, from
PR #11770 for #9489) compensates for signatures only. A blanket "process getDecl() for every DeclRefBase"
experiment produced 57 core-module diagnostics and was reverted; author says the fix must not rely on adding
redundant annotations to consuming APIs.

**Routing.** 20:55Z `issue_opened`: self-assigned by the author, so default would be hold
([[feedback_deadpromise_check_assignee_before_rewake]]). 20:57Z the author commented
*"@nv-slang-bot please look at this issue."* (comment 6132482141, live body re-read = payload) — an explicit
invitation, so the hold is released. Dispatched to `slang-triager` on canonical thread
`gh-issue-shader-slang/slang-13579` with `<github-post-authorized />`. Dedup: no open PR on 13579 /
`collectGenericStructTypeUses`; #9489 closed 06-29 (PR #11770, expipiplus1).

**Open point for triage:** the `SCOPE` case in `tests/diagnostics/capability-generic-struct-entrypoint-param.slang`
currently pins *acceptance* of this exact pattern — a fix flips that expectation, which needs stating up front.

**10-12 20:59Z — triager ack (progress, not a verdict).** Triager reports repro at `f7e14a1a6` (no checker drift vs
master `705c5d8c8`): generic form rc 0, non-generic control E36107. Still verifying the analysis + 57-diag experiment.
Awaiting its triage report on the canonical thread.

**10-12 ~22:00Z — triaged, PARKED on the author's scope decision.** Triager verdict: bug / medium / P2 / frontend
(capability inference). Posted cmt **6133382936** (Main-verified: bot author, 3401 chars, 21:58:58Z, no he/she
pronouns); set Type=Bug. Findings (triager's, source-cited): `visitDirectDeclRef` (`slang-check-decl.cpp:1387`) is
the only decl contribution; five more missed shapes (uniform field read, local, `StructuredBuffer<MetalOnly<3>>`,
signature-only helper, `Outer<3>.In`); only construction (`.init`) is caught. 57-diag experiment reproduced
exactly; limiting to generic structs leaves 50, all from 4 builtin intrinsic types (RWStructuredBuffer,
TensorLayout, CoopMat, CoopVec). Prototype E4 (user aggregates via non-direct decl-ref, minus magic/intrinsic)
gives 0 core-module diags and 7755/7756 locally (gfx-smoke = env) = **partial** fix ("Part of #13579"); builtin
intrinsic generics are a separate design. The SCOPE case is **vacuous**: Main checked that `//SCOPE-NOT: E36107` sits at
line 53 and `diagnostic-annotation-util.cpp` matches only `//PREFIX:` / `/*PREFIX:`, so it has no `-NOT` handling.
16 other test files have the same inert lines (harness gap, unfiled, operator's call).
Fixer NOT dispatched; triager asked kaizhangNV for go/no-go on a bot draft PR. Re-chase task
`rechase-13579-author-sco-be6d` fires 10-19 17:00Z (yes → route via triager; no/own PR → terminal; silent → dashboard).
Scratch: triager's `/workspace/agent/scratch-13579-shaders.tgz` (prototype-E4.diff).

**10-12 22:31Z — author comment 6133848506 (not an answer to the scope question).** kaizhangNV disabled the regression
test `tests/ray-tracing-2/frontend/capabilities/multilevel-acceleration-metal-only.slang` in their **fork** PR
kaizhangNV/slang#24 (`//DISABLE_DIAGNOSTIC_TEST:`, header links #13579; expects `unavailable features in entry point`
for `-target hlsl` because `rt::MultiLevelAccelerationStructure<2>` requires Metal; `scene` reaches the entry point
through `tracer.trace(...)`). They added a checklist: re-enable that test when fixing, and verify the diagnostic. The test exists only
on the fork (`slang.raytracing`, also upstream draft #12691), so an upstream fix PR cannot re-enable it. Main fetched
it via raw.githubusercontent (gh/MCP give 401 on the fork = token scope). Routed to triager on the canonical thread,
NO post authorization (no bot @-mention). Open question for it: does prototype E4 catch this type, or is it
magic/intrinsic and therefore excluded? Re-chase `be6d` is still valid.

**10-13 00:40Z — triager cmt 6135433965** (Main read it): the fork test's `rt::MultiLevelAccelerationStructure` is
`[require(metal)] __intrinsic_type(...)` (`ray-types.slang:239-241`), so prototype E4 would NOT re-enable it. Variant E5
(exclusion limited to core-module decls) fixes that test but changes 4 other `tests/ray-tracing-2/` results (one loses
E36107; others gain or move E36100), so intrinsic-generic propagation is a design decision.

**10-13 17:10Z — AUTHOR GO-AHEAD, park released.** kaizhangNV cmt 6150995602 (live = payload, no literal @-mention):
*"My disabled test won't impact your fix, can you propose a fix for this issue?"* Routed to slang-triager on the
canonical thread (the triager owns the fixer handoff, ANCHOR H) with `<github-post-authorized />`: the comment
answers the bot's own question, on a chain the author opened by @-mentioning the bot (6132482141). Scope ambiguity
("this issue" = whole issue, or the user-aggregate part?) is left to the triager to resolve or ask. Re-chase
`be6d` was rewritten to check whether a PR landed by 10-19.

**10-13 17:22Z — fixer handoff made (triager).** The triager released slang-fixer: one fixer session
`sess-1791911926955-vychna` on the canonical thread, worktree `wt-slang-13579`, branch `fix/issue-13579` at
`5841033344`. Handoff comment **6151193271** (Main read it: bot, 1413 chars, 17:21:38Z, no pronouns) covers the E4
scope, excludes intrinsic/magic generics (RWSB, CoopVec, CoopMat, TensorLayout, fork MLAS), states the behaviour change
(new E36107/E36104), and asks the author whether the intrinsic-generic part stays on #13579 or is tracked separately.
The PR will be a draft saying "Part of #13579". Next: fixer [Fix Report] → triager edits 6151193271 with the PR link and
sends a [Triage Resolution]. Re-chase `be6d` (10-19) is still the backstop.

**10-13 23:12Z — DRAFT PR #13616 opened** ("Infer [require] of generic structs used outside entry-point signatures").
Main checked it live: draft, head `fix/issue-13579` @ `2b008602e4`, bot author, 5 files +300/−50, label `pr: breaking change`.
E4 scope; intrinsic/magic generics excluded. Triager reports 10/10 on the new test (master 1/10) and 7828/7829 on the
full suite (gfx-smoke = env). **Body defect, triager-caught and Main-confirmed:** body line 5 "Open question (blocks
merge): Fixes #13579, or keep…" makes `closingIssuesReferences` = [13579], so merging would close the issue despite
"Part of". The fix (reword the body with no close verb before #13579, then confirm the list is empty) went to the fixer.
CI is draft-gated. Next: fixer [Fix Report] → [Triage Resolution]. Re-chase `be6d` (10-19): the PR exists, so its branch (a) applies.

**10-14 05:01Z — [Triage Resolution]: PARKED on the maintainer's scope decision + a human CI release.** Main checked
PR #13616 live: draft, head `bd38ff9e97`, 12 commits all `nv-slang-bot[bot]`, 6 files +674/−86, `pr: breaking change`,
**closingIssuesReferences = [] (body defect fixed)**, 0 reviews. CI run 38512747808 (workflow_dispatch) is `waiting` at
`bd38ff9e97`, so a human must approve it. Issue comment 6151193271 was edited in place at 05:01:33Z, and it is still the last
comment. Fixer figures (theirs): 35/35 touched directives with the fix vs 20/35 on master; 997/997 capability + diagnostics;
7837/7838 full suite. The internal slang-reviewer went REQUEST_CHANGES (R1) then APPROVE_WITH_NITS (R2 @ 783c433). The nits
were applied at bd38ff9 and the byte-compare was NOT rerun. Scope grew to user enums/interfaces as well as structs.
Resumes on: kaizhangNV answering the intrinsic-generic question, or a CI release. Re-chase `be6d` 10-19 17:00Z.

**10-19 17:00Z — re-chase `be6d` fired: branch (d), still PARKED, no dispatch.** Main read live: issue OPEN, assignee
kaizhangNV, milestoned **Q4 2026 (Fall)** by jhelferty-nv 10-14 17:12Z. Six comments, and 6151193271 (bot) is still the last one,
so the author has **not** answered the intrinsic-generic scope question. PR #13616 is OPEN and draft, head `bd38ff9e97`
(unchanged since 10-14), **closingIssuesReferences = []**, 0 reviews, `statusCheckRollup` is empty, and no workflow runs
exist for the head SHA. The 10-14 waiting run 38512747808 now returns 404, and the PR is BEHIND master by 24 commits.
The only new link is #13637 (albertrodriguezclo), which names #13579 as "Related" in its bot triage, and it is not a duplicate.
Nothing was sent to the triager. The supervisor register (`supervisor-state.json`, `awaiting_human`) keeps the timer; no new
one-shot was created. It resumes on: the author's scope answer, a human review, or a CI release. A rebase is needed before CI.

**10-28 22:59Z — author comment 6482890268: the park is released (substantive, no bot @-mention).** kaizhangNV removed the
RT-specific final module traversal from fork PR kaizhangNV/slang#24 (commit `cbd707f41`): "The general capability
checks should own these cases". They ask that fixing this issue re-enable 4 fork test runs: `stage-intrinsic-capability.slang`
(module-only), `callable-dispatch-stage.slang` (module-only), `cross-stage-input.slang` (`-DTEST_HELPER=1`), and
`multilevel-acceleration-metal-only.slang` (HLSL). All four currently exit 0. Don't add `-ignore-capabilities` to TEST_HELPER;
`trace-dispatch-stage` stays enabled; the generic-interface regression is tracked separately as **#13995** (theirs, open).
⚠️ Two of these runs are exactly the ones E5 changed on 10-13 (extra E36100), and MLAS is `__intrinsic_type`, so this
leans toward "the general fix owns the intrinsic/stage-view generics". The author did not say it explicitly. Main
left that for the triager to resolve or ask.
Live state: PR #13616 is draft, head `bd38ff9e97`, **mergeStateStatus DIRTY**, behind master by 88 and ahead by 12, 0 reviews,
closingIssuesReferences []. Sessions (all stopped): triager `f7n4ns`, fixer `vychna` (holds the PR mapping), and a third
`hin6ce` (slang-reviewer). Routed to slang-triager on the canonical thread with
post authorization (fix-time direction to the bot's own PR, on a chain the author opened by @-mentioning the bot).

**10-28 23:04Z — triager ack (progress, not a verdict).** It is measuring the 4 fork runs at `cbd707f41` against three
builds: the fork as-is, the fork with #13616 merged, and a variant that skips intrinsic types only when they come from the
core module (what MLAS needs). Its hypothesis, unverified: `ClosestHitInput`/`AnyHitInput`/`IntersectionInput` are plain
`[require]` structs, so #13616 should cover the first 3 runs. The fixer handoff, GitHub reply and 5-bullet come after the results.

**10-28 23:36Z — triager result: #13616 covers 3 of the 4 fork runs; a narrowing covers the 4th; fixer re-dispatched.**
The triager measured (theirs) on a local merge of fork `cbd707f41` with #13616 `bd38ff9e97`:
- stage-intrinsic, callable-dispatch and cross-stage `TEST_HELPER` now reject.
- MLAS stays rc 0 until the magic/intrinsic skip is limited to `isFromCoreModule` decls. Then it gives E36107, with no new
  core/standard-module diagnostics, 1090/1090 capability + diagnostics, and 35/35 on the PR tests.
- ray-tracing-2: 257 → 259 → 260 of 261. The remaining failure is the fork's exhaustive `trace-dispatch-stage`, where the
  location moved 30:51 → 30:16; that annotation is the author's to update.
- The 10-13 E5 drift does not reproduce at this fork head.
⚠️ slang-test needs libslang-llvm on LD_LIBRARY_PATH, or filecheck tests are silently skipped (triager's shared learning).
Fresh reply **6483531725** (Main checked: bot, 2369 chars, 23:35:28Z, no pronouns; 8 comments). Treats the author's "general
checks should own these" as the scope answer for standard-module types, and asks whether core-module intrinsics (CoopVec,
RWSB; about 50 E36104) go in #13616 or a follow-up. The fixer (`vychna`, running) has to merge master (no rebase), adopt
the narrowing, record the fork recipe in the PR body, re-run the fork runs, keep the PR draft "Part of", go through the codex
gates and the reviewer, and send a [Fix Report]. One-shot re-check `recheck-13579-fixer-and-3b9c` is set for 11-04 17:00Z.

**10-29 02:30Z — [Triage Resolution]: PARKED again (author's scope answer + a human CI release).** Main checked live:
- PR #13616: draft, head `0d77282d3d`, 23 commits all bot, 7 files +891/−103, `pr: breaking change`, closingIssuesReferences
  [], 0 reviews, mergeState BEHIND (master moved again). CI run 40804024110 is `waiting` at that head.
- Explanation cmt 6157101613 (PR, edited 02:26Z) §7 has the fork recipe. Issue cmt 6483531725 was edited 02:29:45Z (2784 chars,
  no pronouns, 8 comments). It corrects the earlier "~50 E36104" figure, which applies only to the check-everywhere variant.

Changes this round (theirs): master merged in (ed5982ff3, normal push); the magic/intrinsic exclusion now applies only to core-module
types, so MLAS rejects (a test with a user `__intrinsic_type` fails without the change); workgraph note moved
`'Get'`→`'DispatchNodeInputRecord'` (E36107 unchanged); two R4 fixes: non-generic structs in entry-point signatures incl. one
behind a field wrapper, and `Outer<3>.In.make()`.

Tests (theirs): 54/54 PR files (master 25/54); 1199/1199 cap + diag + workgraphs; full suite 11258/11261 (3 fp8-cuda env);
fork runs 4/4 reject; ray-tracing-2 260/261 (author's `trace-dispatch-stage` annotation).

slang-reviewer R4 = REQUEST_CHANGES (small). Its N2 item (skip core-module intrinsic types only while checking core-module
code) is HELD by the triager. Measured on local `drill/13579-n2`, N2 makes 7 runs fail, 3 of them false rejects of valid code
(`OutputPatch` domain shader; `__SubpassImpl` at `hlsl.meta.slang:6711/:24086`). It is only safe after those core-module
`[require]` declarations are fixed, and adopting it would answer the author's scope question for them.

The fixer is idle. The open question to kaizhangNV: fix those declarations and check core-module intrinsic generics in user code
inside #13616, or as a follow-up? #13995 is not covered. The re-check `recheck-13579-fixer-and-3b9c` (11-04 17:00Z) was
rewritten for this park.
