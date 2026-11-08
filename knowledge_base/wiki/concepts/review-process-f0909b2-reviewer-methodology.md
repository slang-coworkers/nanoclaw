---
title: Correctness-review methodology — coverage lenses, codegen reproduction, and self-finding discipline
type: concept
group: review-process
tags: [reviewer, review-lens, revert-drill, positive-control, codegen-reproduction, use-dependent, exit-0, self-raised-finding, file-list, silent-miscompile, probe-matrix, pass-reordering]
source_count: 25
---

# Correctness-review methodology — coverage lenses, codegen reproduction, and self-finding discipline

## TL;DR

Correctness review of Slang compiler PRs turns on two questions: does a test actually EXERCISE the
changed path, and did the reviewer EXECUTE the exact scenario before confirming or refuting? Clean
compiles, exit 0, green validators and passing tests all prove less than they appear.

- **Revert-drill every new parameter, guard and guard conjunct.** Delete it; if no test fails, its
  real (deeper) path is untested, and it often miscompiles silently. Pin each conjunct with a test
  that satisfies every other conjunct.
- **A refreshed CHECK block proves its spelling, not its catch.** Run it against a contrast target
  whose output has the forbidden shape; it must fail there.
- **A structural CHECK/CHECK-NOT is not numeric coverage.** A `-cpu COMPARE_COMPUTE` must route
  through the targeted branch or conformer and pin its result.
- **A guard added at one fallible-query site: search the sibling sites** that run the same query on
  related types. On re-review, check that the shared helper's doc does not overstate its coverage.
- **Moving a lowering pass later:** before review, probe every op × access form × target on master
  and head and diff the status; run Tint on all WGSL (WGSL FileCheck legs never validate).
- **Pooled resource + RAII free + fallible wait = in-flight reuse.** OOM is not device loss.
- **Reproduce the reviewer's EXACT source and flags, and its SUGGESTED test shape, before
  disputing.** Effects are use/lowering-dependent (used vs unused, `-emit-spirv-directly`). A traced
  example is a prediction until executed: report confirmed or refuted, never predicted.
- **A static IR gate is necessary, not sufficient.** Exercise the survival path or say "unverified".
- **Valid is not correct.** Always set `SLANG_RUN_SPIRV_VALIDATION=1` (slangc exits 0 on invalid
  SPIR-V); `-target ptx` is a real CUDA check; a remedy that passes spirv-val can still mislink.
- **A remedy patch gets the PR's own probe matrix before anyone adopts it**: diagnostic counts,
  non-constant and spec-constant inputs, decl-synthesizing expressions. Checker loops over a
  ContainerDecl's members that can call `ensureDecl`/`CheckExpr`/folding iterate by index.
- **Compile a reviewer-proposed test snippet on head before forwarding it**; if it crashes, offer a
  compiling form that reaches the same branch.
- **Exercise new `SLANG_ASSERT`s on a Debug build**: in Release they are `[[assume]]`.
- **If YOUR claim is disputed with a runnable check, run it before defending.**
- **Don't close a finding you raised on the author's EXIT=0**; keep it open as a coverage gap. Push
  back on the critic where it is wrong; concede at once where it is right.
- **Spot-check the full file list of review-fix commits** for scratch `.md`, dotfiles and logs.
- **A clean automated stack is not proof on ABI/legalization PRs**, and diff review never checks spec
  fidelity: map each maintainer spec requirement to met or missed, with a location.
- **Durable text cites stable symbol names, never `file.cpp:NNNN`.** `DIAGNOSTIC_TEST` matches plain
  substrings, so the CHECK must reject the buggy variant.
- **Silent-impossible-shape smell:** a new handler that turns a loud `SLANG_UNEXPECTED` into a silent
  default for any input. Re-assert the invariant.

## Coverage lenses: numeric routing and the revert-drill

slang#12875 (AnyValue bulk-copy / empty-struct legalize) gives two lenses. **Numeric routing:** the
fix targeted the `Foo2` conformer's collapsed-context zero-fill, but the `-cpu` test ran only thread 0
under `numthreads(1)` (selecting `Foo1`) and checked the collapsed path only structurally (`CPP-NOT:
packAnyValue…`), so a live-payload miscompile would pass. Its new `legalizeBitCast` Form-2 in the
shared `legalizeInst` switch also made a loud `SLANG_UNEXPECTED` a silent default for any empty-source
bit_cast; the hardening asserts `as<IRAnyValueType>` before the zero-fill and gates on the source
TYPE, not the operand value
[AnyValue bulk-copy lens: numerically exercised, not just compiled](../learnings/1788301928667-review-lens-anyvalue-bulk-copy-empty-struct-legali.md).
**Revert-drill:** a `bool enclosingPreserved` flag threaded down the recursive `countWordScalarLeaves`
had two tests that never reached the flag; its real job (an undecorated empty inside an undecorated
inner struct inside a preserved outer) was uncovered and would miscompile silently. Delete each new
parameter or guard; if no test fails, ask for the deeper case in both member orders plus a numeric
readback
[a threaded/recursive parameter: revert-drill it](../learnings/1788427795887-review-lens-a-threaded-recursive-parameter-can-be-.md).

Two traps make a passing test prove only its own spelling. **A guard in front of the new leg hides
it:** on slang#13724 R2 the GLSL skip became `m_hasMultiplePushConstantBlocks &&
isPushConstantBlockByLayout(v) && !v->hasUses()`, but the single-block test passed 21/21 even with
`!hasUses()` reverted to the buggy reachability test; only two blocks (one read by an `export`
function, one unused) tell them apart. Pin an emit-time `return SLANG_FAIL` (invisible to slangc
tests) with an `-emit-spirv-via-glsl` run plus `CHECK-NOT: glslang`, never `CHECK-NOT: error`, which
matches slang-test's own "standard error =" header [revert-drill each new leg when a guard sits in front of it](../learnings/1792209485239-revert-drill-each-new-leg-when-a-guard-sits-in-fro.md).
**A stale-CHECK refresh that passes on head and fails on base** shows only that the new spelling
matches. Run it against a target with the forbidden shape (slang#13731: HLSL keeps the `break;` WGSL
drops, and the `X-NOT: break;` after `default :` never covered case 0) until it fails there, and keep
anchors off incidental tokens such as paren counts (`if({{\(*}}…`)
[stale-CHECK refresh: run the block against the forbidden shape](../learnings/1792230096725-reviewing-a-stale-check-refresh-run-the-check-bloc.md).

## Guard fixes: sibling sites and the round-2 checks

slang#13063 fixed a slangi/HostVM `printf("%s", <runtime String>)` SIGSEGV by guarding one call to
the fallible `getNaturalSizeAndAlignment`; sibling `kIROp_Var`/`kIROp_Store` sites query the POINTEE
type (`tryGetPointedToType`) unguarded, so an unrepresentable pointee still got a silent 0-byte slot
(`checkUnsupportedInst` does not run for HostVM). Search sibling sites running the same query; grade
the hole **Gap (not Bug)** while crash-reachability is unverified; ask for one shared
check-diagnose-reset helper. Only Reviewer A's correctness subagents caught this class
[reject-unrepresentable fixes: check sibling layout-query sites](../learnings/1789396536261-reviewing-reject-unrepresentable-input-fixes-check.md).
In round 2 (`getRepresentableSizeAndAlignment` at four sites) check that (a) the helper's doc does not
overstate coverage (it claimed every VM slot; ~16 raw `getNaturalSizeAndAlignment`/`getNaturalOffset`
calls stayed safe only by a PR-body invariant); (b) removal-insensitive guards are marked defensive or
become a `SLANG_ASSERT` (a final-round nit); (c) A-vs-C disagreements on a comment's accuracy are
surfaced, not resolved. A round-1 REQUEST_CHANGES whose round 2 has 0 bugs and only clarity/coverage
gaps maps to APPROVE_WITH_NITS, once Devin's analysis names the round-2 files
[round 2 of a shared-helper guard fix](../learnings/1789401172349-round-2-review-of-a-factored-guard-into-shared-hel.md).

## Moving a lowering pass later

On slang#13699 (issue #13446) `legalizeMatrixTypes` (int/uint/bool matrices → arrays of row vectors)
moved to just after the main `lowerBufferElementTypeToStorageType` (background:
[[wiki/concepts/slang-compiler-ir-type-legalization.md]]). The PR's tests passed; review found five
regressions, each in a pass first seeing an int `IRMatrixType`: `legalizeBinaryOp` treated int
matrices as float (E56102); `lowerMatrixAddresses` lacked `kIROp_SwizzledStore` (E99997), read a
padded std140 row as vec3 via an invalid-WGSL intCast, and mishandled one-column matrices;
`findLeafValueAtOffset` picked the wrong row, breaking float `bit_cast`. A probe set found them: ~25 ops ×
int/uint/bool plus ~20 access forms (swizzle stores, row/element stores, cbuffer reads, transpose,
`mul`, casts, ByteAddressBuffer, params/returns, varyings, CB/SB/PB/push-constant), compiled for
spirv/glsl/wgsl/metal/hlsl on master and head, exit statuses diffed, then Tint over all WGSL
(`node /workspace/agent/tools/tint-13635/tint-validate.mjs *.wgsl`, dawn.node null backend). A WGSL
FileCheck leg never validates (two invalid outputs passed), and `wgsl-spirv-asm` legs are skipped on
Linux (slang-tint is fetched only on Windows x64). Every pass between the old and new position
consumes the new shape, so the matrix belongs before review
[probe every pass in between with the new IR shape](../learnings/1792149352759-moving-a-lowering-pass-later-probe-every-pass-in-b.md),
[probe every op × access form × target before review](../learnings/1792162438787-moving-a-lowering-pass-later-probe-every-op-x-acce.md).

## slang-rhi: pooled staging, RAII free and a fallible wait

On slang-rhi#869 (Vulkan `readBuffer` via the pooled `m_readbackHeap`) a readback copies
GPU→staging, waits with `queue->waitOnHost()` (`vkQueueWaitIdle`), then frees the staging. The wait
can return `VK_ERROR_OUT_OF_HOST/DEVICE_MEMORY`, and OOM is not device loss: the copy may still be in
flight, yet `StagingHeap::Handle::~Handle()` frees with no fence, so a later *sequential* readback
reads torn data. "Mirror `readTexture`" (free only on success) leaks and trips the teardown
`SLANG_RHI_ASSERT(m_totalUsed == 0)`. Couple the free to GPU completion (fence or token) or quarantine
the region. The critique gate on the verdict caught this being closed as "0 bugs" on the device-loss
premise
[pooled staging + RAII free + fallible queue-wait = in-flight page reuse](../learnings/1789444437478-slang-rhi-review-lens-pooled-staging-raii-free-on-.md).

## Reproduce the exact scenario; a static gate is not a proof

Codegen effects are use/lowering-dependent, so a near-miss repro lies. Codex claimed a global
`RayQuery` under `-fspv-reflect` emits `UserTypeGOOGLE "rayquery:<0>"`; a three-test "refutation"
*used* the RayQuery, while codex's case left it **unused** in a `[noinline]` body with
**`-emit-spirv-directly`**, so it survived as an `IRGlobalParam` and got the decoration. Running the
literal case turned a 5-round must-fix into an approve
[reproduce a reviewer's EXACT codegen scenario before disputing](../learnings/1788774818139-reproduce-a-reviewer-s-exact-codegen-scenario-befo.md).
The trap (slang#12922): `addUserTypeHintDecorations` is gated on `as<IRGlobalParam>`, so "these types
lower away, so non-manifesting" does not follow; `DescriptorHandle<T>` globals fold into the parameter
cbuffer while a `Texture2D` global is the control that does emit. Exercise the survival path or say
"unverified" (there the effect was real but benign: a docs or optional-test item)
[an IRGlobalParam gate doesn't prove 'non-manifesting'](../learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md).

When YOU are disputed and a grep, `git merge-tree` or a read at head can settle it, run it before
defending. On slangpy#1091/PR #1162 a 30-second check proved codex right twice (a "needs a live
Device+GPU" test was device-free; `git merge-tree` found real conflicts behind "merge stays clean").
Re-read sibling PRs at head; for a branch weeks behind main, `git diff --name-only
origin/main..<branch>` mostly lists main's drift, so use `merge-tree`. Naming the failure mode does
not inoculate you; only the tool call does
[when a reviewer disputes your claim with a runnable check, run it first](../learnings/1789423550516-when-a-reviewer-disputes-your-claim-with-a-runnabl.md).

A traced example is a prediction until executed. On slang#13283 Reviewer A's 🟡 cross-scope
temporary example (`while (s.a[k+2] != 0) k++; return s.a[k+2];`) emitted identical valid GLSL on PR
and master (`fixValueScoping` had already made a temporary); the real trigger was an if/else with an
early-returning else, where redundancy removal replaces the post-if GEP with the then-block's. For
emitter or scoping findings build PR and base in `wt-<N>-verify` / `wt-<N>-master` (copy `external/`
from `/workspace/agent/slang`, `cmake --preset default`, Release slangc) and probe via `-target spirv
-emit-spirv-via-glsl` (glslang makes an out-of-scope identifier a hard error). Reviewer C's
CLARITY-INCOMPLETE on API 503 `server_error` is retried (grep the log for `api_retry`); Devin's exit 3
on a fresh draft is the normal best-effort skip
[an executed repro beats Reviewer A's traced example](../learnings/1790622924515-slang-reviewer-an-executed-repro-beats-reviewer-a-.md).

Conversely, run the reviewer's *suggested* shape, not just its example. In slang#11709 R2 Reviewer
A's plain-`__ref` example ICEd on master and PR alike and was dismissed, but its suggested `no_diff
const groupshared` test was the regression: `fwd_diff(f)`/`bwd_diff(f)` applied directly to `f(uint
i, no_diff const groupshared float a[4], float x)` emits invalid SPIR-V with rc=0 (spirv-val: "OpLoad
Pointer … is not a logical pointer"), CUDA nvrtc rejects (`(**&s_0)[i]`) and bad Metal; master is
valid. Test a *direct* `fwd_diff`/`bwd_diff(f)` and a *differentiated caller* (only direct broke).
nvrtc 12.6 works in this container; Metal has no downstream compiler here
[run a reviewer's *suggested* repro, not just its example, and validate SPIR-V](../learnings/1790795939082-slang-review-run-a-reviewer-s-suggested-repro-not-.md).

A reviewer's suggested test snippet needs the same check. On slang#13468 Reviewer A's
`useBar<IFoo<int>>(a)` hit E99997 (#13469) on head and master; the compiling form reaching the same
`isInterfaceType(sub)` guard is `useBar<T>(T[2] t) where T : IBar<int>` with `IFoo<int> arr[2]`,
which keeps `T` an interface `DeclRefType` (a plain `IFoo<int>` argument is existential-opened). To
test whether each half of a fix is needed, revert each leg alone in the verify worktree (`git show
<base>:path > path`) and rerun the PR's tests; on #13468 either revert failed all 3
[check a reviewer's suggested test snippet compiles before forwarding it](../learnings/1791335711944-review-check-a-reviewer-s-suggested-test-snippet-c.md).

A clean validator is not a correct program, including for your own remedy (remedy-vs-finding rule:
[Slang code-review lenses](review-pr-slang-review-lenses.md)). On slang#13726 (global varyings shared
by several entry points) a remedy keeping global→Input shadowing for address-passed globals passed
every PR test and four spirv-val probes; a fifth, with an extra varying on the second EP, gave *valid*
SPIR-V where fsA read Location 1 but fsA alone (`-entry fsA`) uses Location 0, a silent mislink. When
a remedy shares one module-scope Input between EPs, compare each EP's `OpDecorate … Location` with
that EP compiled alone; the safe remedy was a diagnostic. GPU trap: WGSL via dawn.node on the L40S
needs `requestDevice({requiredFeatures:['subgroups']})` for subgroup builtins, or Tint rejects `enable
subgroups;` and every output reads 0 on base and head alike
[rejecting a 'make it valid' remedy: per-EP vs single-EP location](../learnings/1792206380082-rejecting-a-make-it-valid-remedy-compare-the-per-e.md).

A reviewer's "tested remedy" needs the PR's adversarial pass from the reviewer (probe matrix,
diagnostic counts) and from an adopting fixer (CODE_REVIEW; probe later declarations, non-constant and
spec-constant arguments, decl-synthesizing expressions). On #14284 verbatim-applied remedy patches
passed the PR tests; later rounds found four regressions in them.
(1) Use-after-free: `for (auto d : parentDecl->getMembersOfType<EmptyDecl>())` called
`checkConstantIntVal` on siblings, and checking can `addMember` (`[__AttributeUsage]` validation
synthesizes an attribute decl in `slang-check-modifier.cpp`), so a List regrow frees the iterator's
storage; a 0–140 padding-size probe found crashes only at 27 and 59. Iterate by index (`for (Index i =
0; i < getDirectMemberDeclCount(); ++i)`) whenever checking can run in the body, as
`ensureAllDeclsRec` documents. (2) Making `checkGLSLLayoutAttribute` drop every failing attribute
removed `binding` from `atomic_uint` (spurious E20016); scope a drop to the one attribute whose
consumer needs it (`VkConstantIdAttribute`). (3) `checkConstantIntVal` reports "not constant" per call,
so E39999 appeared twice (tested only with an undefined identifier, reported once); fold silently with
`CheckExpr` then `CheckIntegerConstantExpression(..., sink=nullptr)`, since a temporary sink swallows
a later E30015. (4) A spec-constant `local_size_x` was folded as a compile-time constant (new E39999)
([reviewer remedies need the same adversarial pass](../learnings/1793762567844-reviewer-remedies-need-the-same-adversarial-pass-m.md),
[probe a reviewer's remedy patch before adopting it](../learnings/1793763695844-probe-a-reviewer-s-remedy-patch-before-adopting-it.md)).

**A new `SLANG_ASSERT` has to run on a Debug build:** in Release it is `SLANG_ASSUME` (`[[assume]]`),
so a false condition is UB. On #13811 `SLANG_ASSERT(oldArrayCount % oldElementCount == 0)` in
`_createArrayTypeLayoutLike` (`slang-ir-legalize-types.cpp`) fired in Debug on valid HLSL (`struct
Inner{Texture2D t; float x;}; struct S{Inner inner; float y; float z;}; S gS[2];`, `-target hlsl
-profile cs_5_0`): HLSL cbuffer array sizes are not element-size multiples. Recipe (~10 min): swap
each new assert/fallback for an `fopen("/tmp/x.log","a")` marker, run the corpus (every SIMPLE test
plus `computeMain` × 5 targets, ~12k compiles) and adversarial shapes, then confirm hits on a Debug
`slangc` (`cmake --build --preset debug --target slangc`). For
`isParameterLocationUsed` reviews, diff a `getEntryPointMetadata` probe over category/space/register
against bindings parsed from emitted code; parse arrays as ranges, or HLSL `T x[2] : register(t0)`
reads as an FP
[release-only review misses SLANG_ASSERT regressions](../learnings/1792582865592-release-only-review-misses-slang-assert-regression.md).

## Self-raised findings, EXIT=0, and the full file list

On slang#12921 the reviewer raised C001 (does excluding extension conformances re-open the
cross-module #12917 bug?) and closed it on the fixer's "EXIT=0 — extension cases compile clean"; codex
OUTPUT_REVIEW caught it. EXIT=0 proves compilation, not that the witness resolves (likely
`_getDefaultCtor` scans only DIRECT members, so an extension-declared conformance falls through to a
raw `DefaultConstructExpr`). Keep such a finding OPEN as a coverage gap and spec the isolating test.
The gate is load-bearing (`[Resolution]`/`[Review Verdict]` delivery is DENIED until OUTPUT_REVIEW
records approve): decline with justification where the critic is wrong (bot reviews are COMMENT-only
and never gate a human merge), concede at once where it is right, never reflexively to clear the gate
[don't close a self-raised finding on the author's unverifiable EXIT=0](../learnings/1788771443270-reviewer-discipline-don-t-close-a-self-raised-find.md).
Also check a review-fixes commit's file list: on slang#12931 an "address review" commit `git add`'d
`.pr-body-12929.md` to the repo root, a merge-blocker no code review catches. Scan follow-up commits
for `.pr-body*.md`, scratch `.md`, dotfiles and `*.log` (`git add .` sweeps them up), and verify a
claimed fix by reading the commit, not its description
[re-check the full file list of post-review fix commits](../learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md).

## Blind spots of the automated review stack

**Subtle ABI/legalization correctness.** On slang#12875 slang-reviewer's 3-reviewer pass,
CodeRabbit, an independent bot review and the codex PLAN/CODE/OUTPUT gates all returned APPROVE with 0
bugs; the maintainer's GPT-5-assisted review found two: an ABI-preserved empty member (zero-leaf but
carrying ExternCpp/Public/BinaryInterfaceType) is not byte-compatible, and a user
`bit_cast<Word>(Empty{})` was silently zero-filled. Provenance-gate the empty-source zero-fill to the
marshalling pass's own whole-object casts so an unmarked user cast stays loud (master: `E99997`; naive
gate: a silent `Word{0}`). A clean pass on a byte-compatibility or type-legalization PR is not yet
proof; apply the numeric lens harder
[maintainer's own deep review caught bugs the automated stack missed](../learnings/1789475349530-maintainer-s-own-deep-review-caught-correctness-bu.md).

**Fidelity to a maintainer's written spec**, because every diff-focused pass checks the code against
itself. On slang-rhi#881 five rounds signed off a head missing two requirements of the spec in #787
comment 5798248018: misuse is an "error if the PRODUCER is Vulkan", but the code keyed on
`ctx->deviceType` (the user), so the headline misuse was only a warning; and "Unowned→Owned(Q) on
initData" was never registered at create. Fetch the spec
(`gh api repos/O/R/issues/N/comments --jq '.[]|select(.user.login=="<maintainer>")'` plus the PR
review comments), and mark each requirement (with its comment link) met or missed with a location
before sign-off. "Partial" is not a lower severity: a missed item gates the verdict until the
maintainer defers it on record (see
[Working Live PRs Alongside Maintainers](../concepts/review-maintainer-live-pr-interaction.md) and
[an unimplemented spec requirement is a merge blocker until the maintainer defers it](../learnings/1790758323478-a-spec-requirement-left-unimplemented-is-a-merge-b.md)).
Tooling trap: `gh run list --commit <sha>` needs the full 40-char SHA; a short one returns `[]`
[review against the maintainer's spec, not just the diff](../learnings/1790583621446-review-against-the-maintainer-s-spec-not-just-the-.md).

## Durable-text disciplines

Both caught by codex OUTPUT_REVIEW. (1) Never cite `file.cpp:NNNN` in source comments, PR
descriptions or review replies (a master merge shifts lines); cite stable symbols
(`SemanticsDeclBasesVisitor::visitEnumDecl`, `_calcInheritanceInfo`). (2)
`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` matches a plain substring (`{{.*}}` regex silently fails, 0/1),
so the CHECK must reject the buggy variant: `//CHECK: cyclic reference '$inheritance'`, not a loose
`//CHECK: cyclic reference` that also matches a wrong `'E'` diagnostic
[never cite file.cpp:line in durable text; DIAGNOSTIC_TEST is substring-only](../learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md).

**Source learnings (25):**
- [Revert-drill each new leg when a guard sits in front of it](../learnings/1792209485239-revert-drill-each-new-leg-when-a-guard-sits-in-fro.md) — #13724 R2: single-block test hid the conjunct; pin emit `SLANG_FAIL` via `CHECK-NOT: glslang`
- [Stale-CHECK refresh: run the block against the forbidden shape](../learnings/1792230096725-reviewing-a-stale-check-refresh-run-the-check-bloc.md) — #13731: HLSL keeps the `break;` WGSL drops; the `X-NOT` never covered case 0
- [Reject a 'make it valid' remedy: per-EP vs single-EP location](../learnings/1792206380082-rejecting-a-make-it-valid-remedy-compare-the-per-e.md) — #13726: valid SPIR-V, silent Location mislink; dawn.node subgroups need a feature flag
- [Moving a lowering pass later: probe every pass in between](../learnings/1792149352759-moving-a-lowering-pass-later-probe-every-pass-in-b.md) — #13699: ~30 probes × 5 targets, base vs head rc diff; Tint catches what FileCheck passed
- [Moving a lowering pass later: probe op × access form × target before review](../learnings/1792162438787-moving-a-lowering-pass-later-probe-every-op-x-acce.md) — five regressions in three passes; `wgsl-spirv-asm` legs skipped on Linux
- [Run a reviewer's *suggested* repro, not just its example](../learnings/1790795939082-slang-review-run-a-reviewer-s-suggested-repro-not-.md) — #11709 R2: `no_diff const groupshared` was the bug; validate SPIR-V; `-target ptx`
- [Check a reviewer's suggested test snippet compiles](../learnings/1791335711944-review-check-a-reviewer-s-suggested-test-snippet-c.md) — #13468: snippet hit E99997; array-argument form; per-leg revert drill
- [An unimplemented spec requirement is a merge blocker until deferred](../learnings/1790758323478-a-spec-requirement-left-unimplemented-is-a-merge-b.md) — grade spec items met/missed; "partial" is not a severity tier
- [AnyValue bulk-copy lens: numerically exercised, not just compiled](../learnings/1788301928667-review-lens-anyvalue-bulk-copy-empty-struct-legali.md) — dispatch the target conformer and pin its result; assert the AnyValue invariant
- [A threaded/recursive parameter: revert-drill it](../learnings/1788427795887-review-lens-a-threaded-recursive-parameter-can-be-.md) — delete the parameter; the deeper nested path is the untested one
- [Reproduce a reviewer's EXACT codegen scenario before disputing](../learnings/1788774818139-reproduce-a-reviewer-s-exact-codegen-scenario-befo.md) — unused vs used and `-emit-spirv-directly` flip the result
- [An IRGlobalParam gate doesn't prove 'non-manifesting'](../learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md) — static gate necessary, not sufficient; exercise survival or say unverified
- [Don't close a self-raised finding on the author's EXIT=0](../learnings/1788771443270-reviewer-discipline-don-t-close-a-self-raised-find.md) — EXIT=0 proves compile, not mechanism; decline vs concede on the critique gate
- [Re-check the full file list of post-review fix commits](../learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md) — scan for `.pr-body*.md`, logs; read the new commit, not its description
- [Reject-unrepresentable fixes: check sibling layout-query sites](../learnings/1789396536261-reviewing-reject-unrepresentable-input-fixes-check.md) — #13063 R1: `kIROp_Var`/`kIROp_Store` left unguarded; Gap not Bug; only A catches it
- [Round 2 of a shared-helper guard fix](../learnings/1789401172349-round-2-review-of-a-factored-guard-into-shared-hel.md) — #13063 R2: doc overstatement, defensive guards; nits-only R2 = APPROVE_WITH_NITS
- [When a reviewer disputes your claim with a runnable check, run it first](../learnings/1789423550516-when-a-reviewer-disputes-your-claim-with-a-runnabl.md) — slangpy PR #1162: grep / `git merge-tree` decide; re-read siblings at head
- [An executed repro beats Reviewer A's traced example](../learnings/1790622924515-slang-reviewer-an-executed-repro-beats-reviewer-a-.md) — #13283: real trigger was an early-return else; C 503s retry; Devin exit 3 skip
- [Pooled staging + RAII free + fallible queue-wait](../learnings/1789444437478-slang-rhi-review-lens-pooled-staging-raii-free-on-.md) — slang-rhi#869: OOM ≠ device loss; fence-free free → torn data; gate the verdict
- [Maintainer's deep review caught bugs the automated stack missed](../learnings/1789475349530-maintainer-s-own-deep-review-caught-correctness-bu.md) — #12875: full stack 0 bugs; ABI empty member, ungated `bit_cast` zero-fill
- [Review against the maintainer's spec, not just the diff](../learnings/1790583621446-review-against-the-maintainer-s-spec-not-just-the-.md) — slang-rhi#881: five rounds missed two spec rules; `gh run list --commit` needs full SHA
- [Never cite file.cpp:line in durable text](../learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md) — cite stable symbols; `DIAGNOSTIC_TEST` is substring-only, reject the buggy variant
- [Release-only review misses SLANG_ASSERT regressions](../learnings/1792582865592-release-only-review-misses-slang-assert-regression.md) — #13811: assert fires only in Debug; marker-instrument a ~12k-compile corpus
- [Reviewer remedies need the same adversarial pass; member-list range-for inside checking is a UAF](../learnings/1793762567844-reviewer-remedies-need-the-same-adversarial-pass-m.md) — #14284 R2: UAF at 27/59 padding decls, broad attribute drop → spurious E20016, duplicate E39999; fold with `sink=nullptr`
- [Probe a reviewer's remedy patch before adopting it verbatim](../learnings/1793763695844-probe-a-reviewer-s-remedy-patch-before-adopting-it.md) — #14284: 4 bugs over 2 rounds incl. spec-constant `local_size_x` folded as constant; CODE_REVIEW + adversarial probes; iterate members by index
