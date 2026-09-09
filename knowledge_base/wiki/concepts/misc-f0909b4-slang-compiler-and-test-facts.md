---
title: Slang compiler internals and test-harness facts (address-of, entry-points, AnyValue, IR passes, CUDA/NVRTC, diagnostic tests)
type: concept
group: misc
tags: [slang, compiler, ir, getaddress, entry-point, anyvalue, dce, cuda, nvrtc, diagnostic-test, filecheck, slang-cli]
source_count: 21
---

## TL;DR

Codebase-specific reference facts gathered while fixing/triaging shader-slang/slang
issues. Grouped by subsystem:

- **Address-of whitelist.** `__getAddress(buf[i])`→E31160 is an AST whitelist gap
  in `getValidTypeForAddressOf`, not a semantic prohibition — `&buf[i]` already
  compiles (routes through `operator&`/`__ref` binding). The fix must enable RW
  *and* RasterizerOrdered buffers and **default** the pointer layout `L` (match
  `&`, not preserve `L` — preserving a generic `L` crashes a RELEASE_ASSERT).
- **Entry-point role conflation.** The EP decoration attaches to the ordinary
  IRFunc; the crash lives in the post-link `translateEntryPointInParamToBorrow`
  when a function is both entry point and non-entry (called/exported). A Release
  spin and a Debug assert can be the *same* bug.
- **AnyValue marshalling** is field-wise 4-byte `bit_cast` per leaf (deliberate
  for correctness). A whole-object fast path must use the *target ABI* layout, not
  Natural layout, or it silently truncates.
- **IR passes**: a DCE epoch-stamp optimization must keep one zeroing per call
  (serialize-ir writes unbounded scratchData); a fixpoint memoization can hit high
  hit rates because keys recur across rounds.
- **Language semantics**: `if(let)` desugars entirely in the parser; `BottomType`/
  `Never` is only the throws-error type, not a noreturn marker (its intent is
  unwired).
- **CUDA/NVRTC**: masked texture stores aren't legalized for CUDA; NVRTC's PCH heap
  is process-global (no program-reuse refactor needed); `[ForceInline]` isn't
  target-gated for CUDA emit.
- **Test harness**: diagnostic tests dedup identical error+span rows and match by
  exact column (exhaustive); `-vk` without `-output-using-type` prints hex;
  `CHECK-NOT: error` false-matches the harness wrapper; slangc integer options are
  space-separated, not `=value`.

## Address-of on structured buffers (slang#12581)

Three atoms from the same investigation nail the `__getAddress(buf[i])` → E31160
fix. [The AST whitelist gap](../learnings/1786986287863-e31160-getaddress-buf-i-rejection-ast-whitelist-ga.md):
E31160 fires at the AST site (`SemanticsExprVisitor::visitAddressOfExpr`, when
`getValidTypeForAddressOf` returns nullptr) — proven a *whitelist gap not a
prohibition* because `&buf[i]` compiles (routes via `operator&`/`__ref` binding)
while `__getAddress` hits the restrictive whitelist. A file's top comment ("we do
not allow taking a pointer from RWStructuredBuffer") can be stale vs its own
un-annotated test line. [The scope of `&`](../learnings/1786988113943-getvalidtypeforaddressof-buf-i-already-compiles-fo.md):
`&buf[i]` already compiles for RW *and* RasterizerOrdered (both share the
`kIROp_RWStructuredBufferGetElementPtr` template), but read-only StructuredBuffer
is `get;`-only and stays correctly rejected — so the fix must enable both mutable
kinds or re-introduce the asymmetry. [The layout default](../learnings/1786990281222-slang-12581-getaddress-buf-i-must-default-layout-l.md):
since #10280 mandates `__getAddress ≡ &`, the whitelist must return
`Ptr<T, RW, UserPointer, DefaultDataLayout>` (matching `&`), NOT preserve the
buffer's `L` — the triage guidance to "preserve L" was wrong for this path, and
preserving a generic `L` crashes `getPtrType`'s `SLANG_RELEASE_ASSERT` because a
`GenericTypeParamDecl` isn't a `ContainerDecl`. Gotcha: `slangc -o /dev/null`
emits a spurious E00004 that masks front-end results — use a real temp path.

## Entry-point / ordinary-function role conflation (slang#12392/#12564)

[The cluster writeup](../learnings/1786994808192-entry-point-ordinary-function-cluster-slang-12392-.md):
a maintainer-acknowledged bug class where one function is both an entry point and
used non-entry (called as subroutine = #12392, imported `export` = #12564). The EP
marker attaches to the ordinary IRFunc itself (`lowerFrontEndEntryPointToIR`); the
crash is in the post-link `translateEntryPointInParamToBorrow` when the function
carries `IREntryPointDecoration` but lacks a selected EP's layout. Because
`SLANG_ASSERT`→`SLANG_ASSUME` in Release, a Release spin/segfault and a Debug
assert are the SAME bug. Empirically, #12565's strip fixes 3/4 targets (cuda/hlsl/
glsl) but NOT spirv — **always run the per-target matrix + pristine baseline
before claiming "PR X fixes issue Y"**; a code-read of the strip predicate wasn't
enough. Instrument note: applying the PR's hunk onto an already-configured clone
beats a fresh worktree (which fails CMake configure on missing submodules).

## AnyValue marshalling (slang#12606/#12609)

[The mechanism](../learnings/1787062369766-anyvalue-marshalling-emits-field-wise-bit-cast-per.md):
dynamic dispatch boxes each conforming type into a flat `AnyValueN` whose
pack/unpack copy ONE 4-byte word at a time via `slang_bit_cast<uint>` (~90 CUDA
lines per pair; 24% of emitted lines in an autodiff repro at n=32). It's a
*faithful printer* — the fix belongs in the IR pass, not emit; CUDA & CPP share
one emitter. Field-wise is deliberate for correctness (non-uniform sizes, bool
normalization, sub-word packing, pointer→uint2, strict-aliasing). [The fast-path
soundness constraint](../learnings/1787068183707-anyvalue-whole-object-bitcast-fast-path-must-use-t.md):
a whole-object `slang_bit_cast<AnyValueN>` byte-compatibility predicate that uses
`getNaturalSizeAndAlignment` is UNSOUND — Natural layout packs `float4` at 4-byte
alignment (dense), but emitted CUDA `float4` is 16-byte aligned, so a
`naturalSize == 4*leafCount` guard is vacuous and a whole-object copy corrupts
data. The predicate must compare against the *target C/CUDA ABI* layout, reject
matrices, exclude CPU-via-LLVM (aggregate `kIROp_BitCast` is invalid IR there),
and add negative tests. (The base fast path is not yet in master, per the
prerequisite-PR triage cross-referenced on the verification page.)

## IR optimization passes (slang#12605/#12603)

[DCE epoch stamp](../learnings/1787069401618-dce-epoch-stamp-on-scratchdata-must-keep-the-per-c.md):
when replacing per-iteration `initializeScratchData` with a generation/epoch
stamp on `IRInst::scratchData`, keep exactly one zeroing per `processInst` and
only `++liveEpoch` inside the loop — do NOT "start the epoch high," because
`slang-serialize-ir.cpp` writes an *unbounded* inst index into the same shared
field, so no offset is collision-proof. Grep all writers for the value *range*,
not just the count of sharers. [Fixpoint memoization](../learnings/1787071148542-judging-memoization-in-a-fixpoint-count-recurrence.md):
before rejecting a cache for a worklist/fixpoint pass, count recurrence *across
convergence rounds*, not along one dataflow path — a `unionSet(s1,s2)` memo that
looked hit-rate-zero along a growing chain actually gave 1.81x because the same
hash-consed operand pairs recur every round. Both are low-risk provably-equivalent
"down-payment" cleanups (bar: byte-identical output + existing regression tests).

## Language semantics (slang#12612)

[`if(let)` desugaring](../learnings/1787093384604-slang-if-let-optional-binding-desugars-entirely-in.md):
`if (let x = opt)` desugars **entirely in the parser** (`parseIfLetStatement`) into
a plain `IfStmt` with `$OptVar.hasValue` predicate and `let x = $OptVar.value` on
the positive branch — the checker and IR lowering see only ordinary member
accesses. A `let ... else` guard cleanly mirrors this at the parser level.
[`BottomType`/`Never`](../learnings/1787094193079-slang-bottomtype-never-is-only-the-throws-error-ty.md):
verified across all 24 occurrences, `Never` is *only* the throws/try error type —
its "a non-returning function's result type is Never" doc-comment intent is
**UNWIRED** (no site reads `getResultType() == BottomType` to mean divergence).
There is no checker-level reachability analysis and no `[noreturn]`; a "this branch
diverges" feature must use a bounded structural check (ends in
`return`/`break`/`continue`/`discard`/`throw`), not a type-based `Never` test.
[The replace-refactor edit-set](../learnings/1787161017583-a-replace-refactor-s-edit-set-filtered-readers-cop.md)
(slang#12623, `UserForceInlineDecoration`): when a new op *replaces* an existing
decoration on a subset of insts, the complete edit-set is exactly three classes —
filtered READERS of OLD, filtered (whitelist) COPIERS of OLD, and BLANKET copiers
(which need no edit and are why the set is finite). Two negative controls catch a
hidden Nth site: wrapper helpers (`is<Name>`/`should<Name>`) and strip/remove
passes. `addDecoration` doesn't dedup, so "supplement" (add alongside) can't
support a decoration-blind gate — producer-decouple pays off only under REPLACE.

## CUDA / NVRTC emission (slang#12620/#12622/#12623/#12624)

[Masked texture store not legalized](../learnings/1787171238862-cuda-masked-texture-store-gtex-i-w-x-not-legalized.md):
`gTex[i].w = x` on CUDA emits a raw subscript on a `CUsurfObject` handle instead
of `surf2Dwrite`, because `slang-ir-legalize-image-subscript.cpp` (which rewrites
ImageSubscript stores into imageLoad/imageStore) is gated to Metal/GLSL/SPIRV only;
CUDA hits `default: break`. Fix direction: add CUDA (and CPP) to the switch.
[NVRTC PCH heap is process-global](../learnings/1787145997814-nvrtc-pch-heap-is-process-global-no-nvrtcprogram-r.md):
the naive read (and DeepWiki's) that Slang's fresh-`nvrtcProgram`-per-compile
forces a program-reuse refactor for `-pch` is WRONG — `nvrtcSetPCHHeapSize` is
process-global and persistent, so `-pch` needs no refactor. Two driver gotchas:
don't add PCH symbols to `SLANG_NVRTC_FUNCS` (breaks `init()` on toolkits < 12.8 —
load null-tolerant + version-gated); the CUDA prelude reaches NVRTC as raw
prepended text, so automatic `-pch` works on it. [CUDA noinline policy](../learnings/1787146536461-cuda-noinline-policy-12620-stacks-on-the-emit-mech.md)
(#12620) stacks on the emit hunk in PR #12419 (`CUDASourceEmitter` emits
`__device__ __noinline__` on `IRNoInlineDecoration`), so the policy work is just a
CLI flag + a CUDA-gated IR pass; a new `-fxxx` hard-fails `check-cmdline-ref`
unless `command-line-slangc-reference.md` is regenerated. [ForceInline CUDA emit](../learnings/1787145904301-reporter-doc-filename-links-nn-topic-md-map-to-sib.md)
(#12624): `[ForceInline]`→`IRForceInlineDecoration` is inlined unconditionally with
no target gate; the CUDA emitter emits zero `__forceinline__`; and this reporter's
`[issue 09](NN-topic.md)` links are internal doc filenames that map to *sibling
same-day GitHub issues*, not real links — search by topic + same author.

## Test-harness and CLI mechanics

Diagnostic-test matching is subtle and must be measured, not reasoned. [Row dedup](../learnings/1786984951149-slang-diagnostic-test-dedups-identical-error-span-.md):
a diagnostic emits TWO machine-readable rows (primary `error` + `span`), but
slang-test DROPS the span row when its location AND message text are identical to
the primary — so those diagnostics need ONE annotation (a second `//CHECK` at the
same caret fails "no row left"). [Consume-once binding](../learnings/1786988534641-slang-test-diag-matcher-consume-once-binding-error.md)
expands the mechanism: each annotation binds one unmatched row and `break`s;
matching is substring-OR against message/severity/errorCode/"severity errorCode".
[E30025 caret column](../learnings/1786990878652-array-invalid-size-e30025-emits-at-the-array-size-.md):
a byte-trace that picks the wrong one of ≥3 `InvalidArraySize` call sites produced
a confident false "will fail" — the diagnostic actually emits at the array-size
expr (col 14), and `slang-test` passes. A caret column is an OUTCOME: read it from
`-enable-machine-readable-diagnostics` or run the test; don't derive it by tracing
`.loc`. [The `-vk` hex misread](../learnings/1786994719051-slang-test-vk-without-output-using-type-prints-hex.md):
`-vk` without `-output-using-type` prints buffer contents as HEX (`0x64`=100), so
a decimal `//CHECK: 100` fails to match — carry `-output-using-type` on every
target line, and run the positive control before declaring a backend broken.
[`CHECK-NOT: error` wrapper false-match](../learnings/1787000622215-slang-test-check-not-error-bare-false-matches-the-.md):
a bare `CHECK-NOT: error` before the first positive CHECK matches "err" in the
harness's `standard error = {` wrapper — use `CHECK-NOT: error:` (the diagnostic
form). [CLI integer options](../learnings/1787168871585-slang-cli-integer-options-are-space-separated-not-.md):
value-bearing slangc options (`_expectInt`/`_expectUInt`) are space-separated
(`-cuda-noinline-threshold 10`), NOT `=value` — the `=` form is silently rejected
(only `-D` splits on `=`), so a `-flag=N` FileCheck test exercises nothing; add a
positive-control CHECK that the output actually changed.

## Source learnings (21):

- [E31160 __getAddress(buf[i]) rejection = AST whitelist gap, not semantic prohibition](../learnings/1786986287863-e31160-getaddress-buf-i-rejection-ast-whitelist-ga.md) — `&buf[i]` works while `__getAddress` fails proves a front-end whitelist barrier; test sibling spellings, trust the compile over the comment.
- [getValidTypeForAddressOf: &buf[i] already compiles for RW AND RasterizerOrdered](../learnings/1786988113943-getvalidtypeforaddressof-buf-i-already-compiles-fo.md) — the fix must enable both mutable kinds; read-only StructuredBuffer stays rejected (`get;`-only). `-o /dev/null` masks front-end results.
- [__getAddress(buf[i]) must DEFAULT layout L to match &buf[i]](../learnings/1786990281222-slang-12581-getaddress-buf-i-must-default-layout-l.md) — return `Ptr<...,DefaultDataLayout>`; preserving a generic `L` crashes `getPtrType`'s RELEASE_ASSERT; verify against the `&` path the fix claims equivalence to.
- [Entry-point/ordinary-function cluster (12392/12564); #12565 fixes 3/4 targets](../learnings/1786994808192-entry-point-ordinary-function-cluster-slang-12392-.md) — role conflation crashes post-link `translateEntryPointInParamToBorrow`; Release spin == Debug assert; run the per-target matrix + pristine baseline.
- [AnyValue marshalling emits field-wise bit_cast per 4 bytes (CUDA/CPP code-size)](../learnings/1787062369766-anyvalue-marshalling-emits-field-wise-bit-cast-per.md) — faithful printer; fix in the IR pass; field-wise is deliberate for correctness; autodiff context structs dominate the big size classes.
- [AnyValue whole-object bitcast fast path must use target ABI layout, not Natural](../learnings/1787068183707-anyvalue-whole-object-bitcast-fast-path-must-use-t.md) — a Natural-layout byte-compat guard is vacuous (dense vs 16-byte float4); compare against target ABI, reject matrices, exclude CPU-via-LLVM.
- [DCE epoch-stamp on scratchData must keep the per-call zeroing](../learnings/1787069401618-dce-epoch-stamp-on-scratchdata-must-keep-the-per-c.md) — serialize-ir writes unbounded indices into the shared field, so no "start-high epoch" is collision-proof; grep writers for the value range.
- [Judging memoization in a fixpoint: count recurrence across rounds, not one path](../learnings/1787071148542-judging-memoization-in-a-fixpoint-count-recurrence.md) — a fixpoint re-processes the same hash-consed keys each round; a chain-distinct key set still caches well (1.81x measured).
- [Slang if(let) optional binding desugars entirely in the parser](../learnings/1787093384604-slang-if-let-optional-binding-desugars-entirely-in.md) — `parseIfLetStatement` builds a plain `IfStmt` on `.hasValue`/`.value`; a `let...else` guard mirrors it at parser level, no new machinery.
- [Slang BottomType/Never is only the throws error type, NOT a noreturn marker](../learnings/1787094193079-slang-bottomtype-never-is-only-the-throws-error-ty.md) — the noreturn intent is unwired; use a bounded structural divergence check; resolve load-bearing type facts by reading all usages firsthand.
- [A "replace" refactor's edit-set = filtered readers/copiers only; blanket clones carry it free](../learnings/1787161017583-a-replace-refactor-s-edit-set-filtered-readers-cop.md) — three classes (filtered readers, filtered copiers, blanket copiers); negative controls: wrapper helpers + strip passes; producer-decouple pays off only under REPLACE.
- [CUDA masked texture store (gTex[i].w=x) not legalized — emits raw subscript](../learnings/1787171238862-cuda-masked-texture-store-gtex-i-w-x-not-legalized.md) — `legalizeImageSubscript` is gated Metal/GLSL/SPIRV only; add CUDA (and CPP) to the switch so masked stores become read-modify-write imageStore.
- [Reporter doc-filename links (NN-topic.md) map to sibling GitHub issues; ForceInline CUDA facts](../learnings/1787145904301-reporter-doc-filename-links-nn-topic-md-map-to-sib.md) — `NN-topic.md` links are internal, resolve to same-author same-day sibling issues; `[ForceInline]` inlined unconditionally, CUDA emits no `__forceinline__`.
- [NVRTC PCH heap is process-global — no nvrtcProgram-reuse refactor needed for -pch](../learnings/1787145997814-nvrtc-pch-heap-is-process-global-no-nvrtcprogram-r.md) — `nvrtcSetPCHHeapSize` persists process-wide; load PCH symbols null-tolerant + version-gated; verify external-toolkit semantics against vendor docs.
- [CUDA noinline policy (#12620) stacks on the emit mechanism PR #12419](../learnings/1787146536461-cuda-noinline-policy-12620-stacks-on-the-emit-mech.md) — emit spelling lives in #12419; policy work is a CLI flag + CUDA-gated IR pass; a new `-fxxx` breaks `check-cmdline-ref` without regenerating the docs.
- [Slang DIAGNOSTIC_TEST dedups identical error+span rows to one annotation](../learnings/1786984951149-slang-diagnostic-test-dedups-identical-error-span-.md) — the span row drops when its location+message equal the primary; write one annotation for those; verify empirically with `-enable-machine-readable-diagnostics`.
- [slang-test diag= matcher: consume-once binding + error/span row duplication](../learnings/1786988534641-slang-test-diag-matcher-consume-once-binding-error.md) — each annotation binds one unmatched row and breaks; substring-OR matching enforces both E-code and severity.
- [array-invalid-size E30025 emits at the array-size expr (col 14), not the VarDecl name](../learnings/1786990878652-array-invalid-size-e30025-emits-at-the-array-size-.md) — a byte-trace picked the wrong one of ≥3 diagnose sites and produced a confident false "will fail"; caret column is an outcome — measure it.
- [slang test: -vk without -output-using-type prints HEX — do not misread as wrong values](../learnings/1786994719051-slang-test-vk-without-output-using-type-prints-hex.md) — carry `-output-using-type` on every target line; run the positive control through the instrument before asserting a backend is broken.
- [slang-test: //CHECK-NOT: error (bare) false-matches the 'standard error = {' wrapper](../learnings/1787000622215-slang-test-check-not-error-bare-false-matches-the-.md) — use `CHECK-NOT: error:` (the diagnostic form) so it scans the whole output without tripping the harness wrapper.
- [Slang CLI integer options are space-separated, not =value](../learnings/1787168871585-slang-cli-integer-options-are-space-separated-not-.md) — `-flag N` not `-flag=N` (only `-D` splits on `=`); a `-flag=N` FileCheck test silently exercises nothing — add a positive-control CHECK.
