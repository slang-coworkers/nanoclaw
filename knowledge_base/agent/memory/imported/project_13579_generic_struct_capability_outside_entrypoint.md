---
type: project
name: project_13579_generic_struct_capability_outside_entrypoint
description: "slang#13579 (kaizhangNV, filed + self-assigned 10-12 20:55Z): [require(...)] on a GENERIC struct is not enforced when used via an ordinary call; follow-up to #9489 / PR #11770 (entry-point-signature-only check). Author @-asked the bot to look (10-12 20:57Z) -> routed to slang-triager on gh-issue-shader-slang/slang-13579."
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
