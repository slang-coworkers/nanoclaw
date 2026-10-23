---
title: Correctness-review methodology — coverage lenses, codegen reproduction, and self-finding discipline
type: concept
group: review-process
tags: [reviewer, review-lens, revert-drill, positive-control, codegen-reproduction, use-dependent, exit-0, self-raised-finding, file-list, silent-miscompile, probe-matrix, pass-reordering]
source_count: 23
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
- **Compile a reviewer-proposed test snippet on head before forwarding it**; if it crashes, offer a
  compiling alternative that reaches the same branch.
- **Exercise new `SLANG_ASSERT`s on a Debug build**: in Release they are `[[assume]]`.
- **When someone disputes YOUR claim with a runnable check, run it before defending.**
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
fix targeted the `Foo2` conformer whose collapsed context drives a new zero-fill, but the `-cpu` test
dispatched only thread 0 under `numthreads(1)`, which selects `Foo1`. The collapsed path was checked
only structurally (`CPP-NOT: packAnyValue…`), so a live-payload miscompile would pass. The same PR's
new `legalizeBitCast` Form-2 sat in the shared all-targets `legalizeInst` switch and turned a loud
`SLANG_UNEXPECTED` into a silent default for any empty-source bit_cast; the hardening asserts
`as<IRAnyValueType>` before the zero-fill and gates on the source TYPE, not the operand value
[AnyValue bulk-copy lens: numerically exercised, not just compiled](../learnings/1788301928667-review-lens-anyvalue-bulk-copy-empty-struct-legali.md).
**Revert-drill:** a `bool enclosingPreserved` flag threaded down the recursive
`countWordScalarLeaves` had two new tests, but both tripped a local check (the empty was a direct
field) and never the flag. Its real job, an undecorated empty inside an undecorated inner struct
inside a preserved outer, had no coverage, and the failure mode was a silent miscompile. Delete any
new parameter or guard and see whether a test fails; if none does, ask for the deeper case in both
member orders plus a numeric readback
[a threaded/recursive parameter: revert-drill it](../learnings/1788427795887-review-lens-a-threaded-recursive-parameter-can-be-.md).

Two traps make a passing test prove only its own spelling. **A guard in front of the new leg hides
it.** On slang#13724 R2 the GLSL skip became `m_hasMultiplePushConstantBlocks &&
isPushConstantBlockByLayout(v) && !v->hasUses()`, but the test used a single-block module, so
swapping `!hasUses()` back to the buggy reachability test still passed 21/21. Only a module with two
blocks, one read by an `export` function and one unused, tells them apart. An emit-time
`return SLANG_FAIL` is also invisible to slangc-based tests, because slangc already suppresses output
on error and DIAGNOSTIC_TEST does not parse glslang's text: pin it with an `-emit-spirv-via-glsl` run
plus `CHECK-NOT: glslang`, never `CHECK-NOT: error`, which matches slang-test's own "standard error ="
header [revert-drill each new leg when a guard sits in front of it](../learnings/1792209485239-revert-drill-each-new-leg-when-a-guard-sits-in-fro.md).
**A stale-CHECK refresh that passes on head and fails on base** shows only that the new spelling
matches. Copy the block into a temp test and run it against a target whose output has the forbidden
shape. For slang#13731 that was HLSL, which keeps the trailing `break;` that WGSL drops, and the
`X-NOT: break;` placed after `default :` had never covered case 0. Tighten the block until it passes
on the real target and fails on the contrast target, and keep anchors off incidental tokens such as
paren counts (`if({{\(*}}…`), since re-pinning those is what made the test stale
[stale-CHECK refresh: run the block against the forbidden shape](../learnings/1792230096725-reviewing-a-stale-check-refresh-run-the-check-bloc.md).

## Guard fixes: sibling sites and the round-2 checks

slang#13063 fixed a slangi/HostVM `printf("%s", <runtime String>)` SIGSEGV by guarding one site that
calls the fallible `getNaturalSizeAndAlignment`. The sibling `kIROp_Var`/`kIROp_Store` sites query the
POINTEE type (`tryGetPointedToType`) and stayed unguarded, so an unrepresentable pointee still got a
silent 0-byte slot, and the `checkUnsupportedInst` safety net the PR cited does not run for HostVM.
For any "reject unrepresentable input" fix, search the sibling sites that run the same query; grade
the hole **Gap (not Bug)** while crash-reachability is unverified, and ask for one shared
check-diagnose-reset helper at every layout-query site. Only Reviewer A's correctness subagents caught
this class; B and C rarely flag missing sibling coverage
[reject-unrepresentable fixes: check sibling layout-query sites](../learnings/1789396536261-reviewing-reject-unrepresentable-input-fixes-check.md).
In round 2, with `getRepresentableSizeAndAlignment` routed through four sites, check three more
things. (a) The helper's doc must not overstate coverage: it claimed every VM slot, while ~16 raw
`getNaturalSizeAndAlignment`/`getNaturalOffset` calls stayed safe only by an invariant stated in the
PR body. (b) Removal-insensitive guards (`kIROp_Var`/`kIROp_Store`, already covered by type-keyed
dedup and a co-located function-result guard) should be marked defensive or become a `SLANG_ASSERT`;
on a final round that is a nit, not a removal demand. (c) A-vs-C disagreements about a comment's
accuracy are surfaced, not resolved. A round-1 REQUEST_CHANGES whose round 2 has 0 bugs and only
clarity or coverage gaps maps to APPROVE_WITH_NITS; confirm Devin analyzed the new head (its analysis
names the round-2 files) before trusting a "clean" result
[round 2 of a shared-helper guard fix](../learnings/1789401172349-round-2-review-of-a-factored-guard-into-shared-hel.md).

## Moving a lowering pass later

On slang#13699 (issue #13446) `legalizeMatrixTypes`, which turns int/uint/bool matrices into arrays of
row vectors, moved from before the main `lowerBufferElementTypeToStorageType` to just after it
(background: [[wiki/concepts/slang-compiler-ir-type-legalization.md]]). The PR's tests passed; two
review rounds then found five regressions, each in a pass that saw an int `IRMatrixType` for the first
time. `legalizeBinaryOp` (called by `legalizeIRForWGSL` and `legalizeIRForMetal`) treated int
matrices as float (`/` gave E56102 or `1.0h/s`, and a matrix shift amount was not made unsigned).
`lowerMatrixAddresses` had no `kIROp_SwizzledStore` case (`buf[0].m[1].xz = …` aborted with E99997),
read a padded std140 vec4 row as vec3 through a new `emitCast` that emitted an invalid-WGSL intCast,
and mishandled the scalar row of a one-column matrix on load and store. `findLeafValueAtOffset` picked
the wrong row, which also broke float `bit_cast`. A generated probe set found them, not the PR's
tests: ~25 binary and unary ops × int/uint/bool, plus ~20 access forms (swizzle store, `+=` through a
swizzle, row and element store, cbuffer row and whole-matrix reads, transpose, `mul`, casts,
ByteAddressBuffer Load/Store, inout and function params and returns, varyings, CB/SB/PB/push-constant
containers). Compile each for spirv/glsl/wgsl/metal/hlsl with master and head builds, diff the exit
status, then run Tint over all WGSL output (`node /workspace/agent/tools/tint-13635/tint-validate.mjs
*.wgsl`, dawn.node null backend). FileCheck legs passed two invalid WGSL outputs because a WGSL
FileCheck leg never validates, and `wgsl-spirv-asm` legs are skipped on Linux (slang-tint is fetched
only on Windows x64). Every pass between the old and new position consumes the new shape, so the probe
matrix belongs before review
[probe every pass in between with the new IR shape](../learnings/1792149352759-moving-a-lowering-pass-later-probe-every-pass-in-b.md),
[probe every op × access form × target before review](../learnings/1792162438787-moving-a-lowering-pass-later-probe-every-op-x-acce.md).

## slang-rhi: pooled staging, RAII free and a fallible wait

On slang-rhi#869 (Vulkan `readBuffer` via the pooled `m_readbackHeap`) a readback submits a
GPU→staging copy, waits with `queue->waitOnHost()` (`vkQueueWaitIdle`), then frees the staging.
`vkQueueWaitIdle` can return `VK_ERROR_OUT_OF_HOST/DEVICE_MEMORY`, and OOM is not device loss: the
queue is alive and the copy may still be in flight. `StagingHeap::Handle::~Handle()` frees with no
completion fence, so the wait-fail path marks the region reusable mid-copy, and a later *sequential*
readback re-allocs it and reads torn data. "Mirror `readTexture`" is also wrong: it frees only on
success, so a failure leaks and trips the teardown `SLANG_RHI_ASSERT(m_totalUsed == 0)`. The robust
fixes couple the free to GPU completion (fence or token) or quarantine the region. Run the critique
gate on the verdict as well as the code: it caught this being closed as "0 bugs, not blocking" on the
device-loss premise
[pooled staging + RAII free + fallible queue-wait = in-flight page reuse](../learnings/1789444437478-slang-rhi-review-lens-pooled-staging-raii-free-on-.md).

## Reproduce the exact scenario; a static gate is not a proof

Codegen effects are use/lowering-dependent, so a near-miss repro lies. Codex claimed a global
`RayQuery` under `-fspv-reflect` emits `UserTypeGOOGLE "rayquery:<0>"`. A three-test "refutation" was
wrong because every test *used* the RayQuery (lowering it to query ops and copying it to a local),
while codex's case left it **unused** in a `[noinline]` body and added **`-emit-spirv-directly`**, so
it survived as an `IRGlobalParam` and got the decoration. Running the literal case turned a 5-round
must-fix into an approve
[reproduce a reviewer's EXACT codegen scenario before disputing](../learnings/1788774818139-reproduce-a-reviewer-s-exact-codegen-scenario-befo.md).
The trap behind it (slang#12922, which names six opaque builtins in `getTypeNameHint`):
`addUserTypeHintDecorations` is gated on `as<IRGlobalParam>`, and "these types lower away, so the
effect is non-manifesting" does not follow. A used and an unused global RayQuery differ, and
`DescriptorHandle<T>` globals fold into the parameter cbuffer while a `Texture2D` global is the control
that does emit. Exercise the survival path or say "unverified"; the effect there was real but
additive and benign (a docs or optional-test item, not a bug)
[an IRGlobalParam gate doesn't prove 'non-manifesting'](../learnings/1788774851147-reviewer-trap-an-irglobalparam-gate-doesn-t-prove-.md).

The rule holds when YOU are the one disputed: if a grep, a `git merge-tree` or a read at the current
head can settle it, run it before writing a defense. On slangpy#1091/PR #1162 a 30-second check proved
codex right twice: a "needs a live Device+GPU" test was Python-bound and device-free, and `git
merge-tree` found real conflicts behind "merge stays clean". Re-read a fast-moving sibling PR at its
current head, not from memory. For a branch weeks behind main, `git diff --name-only
origin/main..<branch>` mostly lists main's own drift, so compare the files both sides changed or use
`merge-tree`. Naming the failure mode does not inoculate you; only the tool call does
[when a reviewer disputes your claim with a runnable check, run it first](../learnings/1789423550516-when-a-reviewer-disputes-your-claim-with-a-runnabl.md).

A reviewer's traced example is a prediction until someone executes it. On slang#13283 Reviewer A's 🟡
cross-scope temporary example (`while (s.a[k+2] != 0) k++; return s.a[k+2];`) emitted the same valid
GLSL on PR and master, because `fixValueScoping` had already given the index a temporary. The real
trigger was an if/else whose else returns early, where redundancy removal lets a GEP in the dominating
then-block replace the GEP after the if. For emitter or scoping findings, build PR and base in
`wt-<N>-verify` / `wt-<N>-master` (copy `external/` from `/workspace/agent/slang`, `cmake --preset
default`, Release slangc) and probe through `-target spirv -emit-spirv-via-glsl`, where glslang turns
an out-of-scope identifier into a hard error. The same review saw Reviewer C exit CLARITY-INCOMPLETE on
API 503 `server_error` (grep the log for `api_retry`, then retry) and Devin exit 3 on a fresh draft,
which is the normal best-effort skip
[an executed repro beats Reviewer A's traced example](../learnings/1790622924515-slang-reviewer-an-executed-repro-beats-reviewer-a-.md).

The converse failure is running only the example when the reviewer also suggested a sharper shape. In
slang#11709 R2 Reviewer A's plain-`__ref` example ICEd on master and PR alike, so its claim (the
backward-diff `Ref` mapping makes a `no_diff groupshared` parameter by-value) was dismissed, but its
*suggested* `no_diff const groupshared` test was the regression. `fwd_diff(f)`/`bwd_diff(f)` applied
directly to `f(uint i, no_diff const groupshared float a[4], float x)` emits invalid SPIR-V with rc=0
(spirv-val: "OpLoad Pointer … is not a logical pointer"), CUDA that nvrtc rejects (`(**&s_0)[i]`) and
Metal that dereferences an array value, while master is valid for all three. Test both a *direct*
`fwd_diff`/`bwd_diff(f)` and a *differentiated caller* of `f`, since only the direct path broke. nvrtc
12.6 works in this container; Metal has no downstream compiler here
[run a reviewer's *suggested* repro, not just its example, and validate SPIR-V](../learnings/1790795939082-slang-review-run-a-reviewer-s-suggested-repro-not-.md).

A test snippet a reviewer offers as the *fix* for a coverage gap needs the same check. On slang#13468
Reviewer A's snippet `useBar<IFoo<int>>(a)`, whose body calls the requirement `t.v()`, hit E99997
"Unexpected context type for parameter info retrieval" (#13469) on head and master. The compiling
alternative that reaches the same `isInterfaceType(sub)` guard is the array form
`useBar<T>(T[2] t) where T : IBar<int>` called with `IFoo<int> arr[2]`, which keeps `T` an interface
`DeclRefType`; a plain `IFoo<int>` argument is existential-opened and never reaches the guard. The
revert drill also answers "is each half of the fix needed?": revert each leg alone in the verify
worktree (`git show <base>:path > path`) and rerun the PR's tests. On #13468 either single revert
failed all 3 tests
[check a reviewer's suggested test snippet compiles before forwarding it](../learnings/1791335711944-review-check-a-reviewer-s-suggested-test-snippet-c.md).

A clean validator is not a correct program, and that includes your own remedy (the remedy-vs-finding
rule is on [Slang code-review lenses](review-pr-slang-review-lenses.md)). On slang#13726 (global
varyings shared by several entry points) a remedy that kept the global→Input shadowing for
address-passed globals passed every PR test and four spirv-val probes. A fifth, where the second EP has
an extra varying, still gave *valid* SPIR-V, but fsA read the input at Location 1 while fsA compiled
alone (`-entry fsA`) uses Location 0: a silent mislink. When a remedy shares one module-scope Input
between entry points, compare each EP's `OpDecorate … Location` with the same EP compiled alone; the
safe remedy there was a diagnostic. A GPU trap from the same review: WGSL through dawn.node on the L40S
needs `requestDevice({requiredFeatures:['subgroups']})` for subgroup builtins, or Tint rejects
`enable subgroups;` and every output reads 0 on base and head alike
[rejecting a 'make it valid' remedy: per-EP vs single-EP location](../learnings/1792206380082-rejecting-a-make-it-valid-remedy-compare-the-per-e.md).

**A new `SLANG_ASSERT` has to run on a Debug build.** In Release `SLANG_ASSERT` is `SLANG_ASSUME`
(`[[assume]]`), so a false condition is silent UB, and a Release-only fixer and reviewer never see it.
On #13811 a new `SLANG_ASSERT(oldArrayCount % oldElementCount == 0)` in `_createArrayTypeLayoutLike`
(`slang-ir-legalize-types.cpp`) fired in Debug on valid HLSL (`struct Inner{Texture2D t; float x;};
struct S{Inner inner; float y; float z;}; S gS[2];`, `-target hlsl -profile cs_5_0`), because HLSL
cbuffer array sizes are not multiples of the element size. The recipe takes about 10 minutes: in an
instrumented worktree replace each new assert and fallback with an `fopen("/tmp/x.log","a")` marker,
run the corpus (every SIMPLE test plus `computeMain` × 5 targets, ~12k compiles) and adversarial shapes
through it, then confirm any hit on a Debug `slangc` (`cmake --build --preset debug --target slangc`,
~6 min). For `isParameterLocationUsed` reviews, diff a `getEntryPointMetadata` probe over
category/space/register against bindings parsed from the emitted code for a per-shape × target FP/FN
table; parse arrays as ranges, or HLSL `T x[2] : register(t0)` reads as an FP
[release-only review misses SLANG_ASSERT regressions](../learnings/1792582865592-release-only-review-misses-slang-assert-regression.md).

## Self-raised findings, EXIT=0, and the full file list

On slang#12921 the reviewer raised C001 (does excluding extension conformances re-open the
cross-module #12917 bug?) and closed it on the fixer's "EXIT=0 — extension cases compile clean"; the
codex OUTPUT_REVIEW gate caught it. EXIT=0 proves the program compiled, not that the witness resolves
despite its visibility. The likely real mechanism: `_getDefaultCtor` scans only DIRECT members, so an
extension-declared conformance is never found and the path falls through to a raw
`DefaultConstructExpr`. Keep such a finding OPEN as a coverage/justification gap and spec the isolating
test. The critique gate is load-bearing: delivery of `[Resolution]`/`[Review Verdict]` markers is
DENIED until an OUTPUT_REVIEW records approve via the exact protocol. Justify and decline where the
critic is wrong (bot reviews are COMMENT-only and never gate a human merge), concede at once where it
is right, and never concede reflexively to clear the gate
[don't close a self-raised finding on the author's unverifiable EXIT=0](../learnings/1788771443270-reviewer-discipline-don-t-close-a-self-raised-find.md).
A review-fixes commit also needs a file-list check, not just its hunks. On slang#12931 an "address
review" commit `git add`'d `.pr-body-12929.md` to the repo root, a merge-blocker no code review
catches. Scan every follow-up commit's touched files for `.pr-body*.md`, scratch `.md`, dotfiles and
`*.log` (a broad `git add .` sweeps them up), and verify a claimed fix by reading the new commit, not
its description
[re-check the full file list of post-review fix commits](../learnings/1788799970382-re-check-the-full-file-list-of-post-review-fix-com.md).

## Blind spots of the automated review stack

**Subtle ABI/legalization correctness.** On slang#12875 (the AnyValue PR above) slang-reviewer's
3-reviewer pass, CodeRabbit, an independent bot review and the codex PLAN/CODE/OUTPUT gates all
returned APPROVE with 0 correctness bugs. The maintainer's own GPT-5-assisted review found two. An
ABI-preserved empty member (zero-leaf but carrying ExternCpp/Public/BinaryInterfaceType) is not
byte-compatible. A user `bit_cast<Word>(Empty{})` was silently zero-filled: the empty-source zero-fill
has to be provenance-gated to the marshalling pass's own whole-object casts, so that an unmarked user
cast stays a loud failure (master: `E99997`; the naive gate: a silent `Word{0}`). Treat a clean pass
on a byte-compatibility or type-legalization PR as not yet proven, and apply the numeric lens harder
[maintainer's own deep review caught bugs the automated stack missed](../learnings/1789475349530-maintainer-s-own-deep-review-caught-correctness-bu.md).

**Fidelity to a maintainer's written spec**, because every diff-focused pass checks the code against
itself. On slang-rhi#881 five rounds signed off a head that missed two requirements from the spec in
#787 comment 5798248018. The spec said cross-queue ownership misuse is an "error if the PRODUCER is
Vulkan", but the code decided on `ctx->deviceType`, the device doing the use, so the headline misuse
(CUDA using a resource Vulkan still owns) was only a warning; and "Unowned→Owned(Q) on initData" was
never registered at create. Fetch the spec
(`gh api repos/O/R/issues/N/comments --jq '.[]|select(.user.login=="<maintainer>")'` plus the PR
review comments), list each requirement with its comment link, and mark it met or missed with a
location before sign-off. "Partial" says how much is missing, not a lower severity: a missed item
gates the verdict until the maintainer defers it on record (see
[Working Live PRs Alongside Maintainers](../concepts/review-maintainer-live-pr-interaction.md) and
[an unimplemented spec requirement is a merge blocker until the maintainer defers it](../learnings/1790758323478-a-spec-requirement-left-unimplemented-is-a-merge-b.md)).
Tooling trap: `gh run list --commit <sha>` needs the full 40-character SHA; a short one silently
returns `[]`
[review against the maintainer's spec, not just the diff](../learnings/1790583621446-review-against-the-maintainer-s-spec-not-just-the-.md).

## Durable-text disciplines

Two disciplines, both caught by codex OUTPUT_REVIEW. (1) Never cite `file.cpp:NNNN` in source
comments, PR descriptions or review replies: a maintainer merging master shifts every line number. Use
stable symbol names (`SemanticsDeclBasesVisitor::visitEnumDecl`, `_calcInheritanceInfo`); line numbers
belong only in scratch and logs. (2) `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` matches message text as a
plain substring; `{{.*}}` FileCheck regex is not supported and silently fails (0/1). The CHECK must
also reject the buggy variant: `//CHECK: cyclic reference '$inheritance'`, not a loose
`//CHECK: cyclic reference` that also matches a wrong `'E'` diagnostic and would not catch a revert
[never cite file.cpp:line in durable text; DIAGNOSTIC_TEST is substring-only](../learnings/1789489933746-never-cite-file-cpp-line-in-source-comments-or-pr-.md).

**Source learnings (23):**
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
