---
title: "aarch64-only wrong results and slangi VM operand-width/cast bugs (slang#12871 family)"
type: concept
group: misc
tags: [aarch64, slangi, host-vm, cast, signed-unsigned, undefined-behavior, printf, root-cause, repro, autodiff]
source_count: 9
---

## TL;DR

A cluster around shader-slang/slang#12871: forward-mode autodiff of a user
`IFloat` `neg()` printed `0 0` instead of `-9 -6`, but only on aarch64 (correct on
x86_64), under the `slangi` byte-code interpreter. The saga produced a durable,
reusable diagnostic signature and several method lessons:

- **Arch-only wrong numeric value (a negative that comes back `0`, or a huge
  positive), deterministic, on aarch64 but correct on x86_64 ⇒ suspect a
  float→unsigned (or signed-through-unsigned) cast, not emit divergence or
  nondeterminism.** `static_cast<uint32_t>(-9.0f)` is UB; x86_64 `cvttss2si` is
  accidentally correct, aarch64 `fcvtzu` saturates negatives to 0. The true root
  cause was exactly this: the `slangi` interpreter's two `getCastHandler`
  dispatchers mapped `kSlangByteCodeScalarTypeSignedInt` to *unsigned* C++ types
  (a copy-paste slip). Fix: route the signed case through `int8/16/32/64_t`.
- The tempting hypotheses were wrong. The uninitialized `PathInfo::type` read
  (fixed by #12879) is genuine UB but *benign in effect* (a short-circuiting
  `&&` on an empty `foundPath` forces the predicate false regardless), so #12879's
  aarch64 CI still printed `0 0` WITH the fix. "UB confirmed" ≠ "UB explains the
  symptom." And the `-cpu`/host-callable target and the `slangi`/HostVM target are
  distinct emit paths, so a HostVM-only fix does not touch `-cpu`.
- **A code-path argument ("these use different mechanisms") is not a root-cause
  dedup.** Without a repro, subsystem/dedup classification is provisional — the
  maintainer's aarch64-hardware repro reversed a confident "NOT a dup."
- Consumer-side sibling: `slangi` printf reads a `double` as a `float` for plain
  `%f`/`%e`/`%g` — the operand is correctly 8 bytes end-to-end, but the formatter
  picks read-width from the format spec. Apply the **revert drill** to any
  operand-width fix: the real regression guard is often a different existing test.

## The diagnostic signature and root cause

An **arch-only wrong value that flows through an `(int)`/`(uint)` cast** is the
signature. The disambiguator is cheap: print with `%f` (no cast) — if that is
correct on both arches but `%d`/`(int)` gives `0` (or garbage) on one, the cast is
the bug. Casting a negative float to an unsigned integer is UB, and the two ISAs
diverge exactly there: x86_64 lowers `(int)f` to `cvttss2si` (produces the
two's-complement bit pattern, accidentally correct on a signed reinterpret),
aarch64 lowers an unsigned conversion to `fcvtzu` (saturates negatives to 0)
([arch-only wrong result from (int)float? suspect the cast](../learnings/1788889922238-arch-only-wrong-result-from-int-float-suspect-the-.md)).
The maintainer, on physical aarch64 hardware, found exactly this: both
`getCastHandler` dispatchers in `slang-vm-inst-impl.cpp` mapped
`kSlangByteCodeScalarTypeSignedInt` to an unsigned C++ type, a copy-paste slip
from the adjacent unsigned case. The dual bug made signed→float read the operand
as unsigned on *every* platform (`(float)(-9)` → ~4.29e9). Fix: 8 lines, signed
case → signed C++ types in both dispatchers; the emitted byte-code and the
autodiff transform were correct all along
([RESOLVED: aarch64 IFloat neg() 0/0 was a signed→unsigned cast bug, not emit divergence](../learnings/1788888872953-resolved-aarch64-ifloat-neg-0-0-was-a-signed-unsig.md),
[true root cause = signed-int cast UB in byte-code interpreter](../learnings/1788906006649-approver-challenger-note-slang-12871-true-root-cau.md)).

## Why the tempting hypotheses were red herrings

The uninitialized `PathInfo::type` read (during host-VM module serialization,
fixed one-line by #12879) is genuine UB, but `PathInfo::hasFoundPath()` is
`(type ∈ {…}) && foundPath.getLength() > 0`; for the synthesized host-VM wrapper
module `foundPath` is empty, so the `&&` short-circuits to false regardless of the
uninitialized `type`. #12879's own aarch64 CI legs still print `0 0` WITH the fix
— empirical proof it does not cure the symptom. The lesson: a valgrind "conditional
jump depends on uninitialised value" through a boolean predicate does NOT imply the
predicate's *result* differs; check whether the other conjunct already forces the
outcome, and demand the empirical before/after on the *symptom platform*, not just a
clean valgrind on x86_64
([host-VM PathInfo::type UB is NOT the aarch64 0-0 root cause](../learnings/1788889414933-approver-challenger-note-slang-12871-host-vm-pathi.md)).
Separately, the `-cpu`/host-callable target (`emitLLVMForEntryPoints` /
`emitWithDownstreamForEntryPoints`, C++ text via `CPPSourceEmitter`, never
constructs a Module or calls `serialize()`) and the `slangi`/HostVM target
(`emitHostVMCode` → `new Module` → `serialize()` → `PathInfo::type` read) do NOT
share a module-serialization path — so #12879's HostVM-only fix cannot fix a `-cpu`
repro of the same symptom
([-cpu/host-callable and slangi/HostVM are distinct emit paths](../learnings/1788383948543-cpu-host-callable-and-slangi-hostvm-are-distinct-e.md)).

## Method lessons from an x86_64-only fixer chasing an aarch64 bug

Rule out the runtime layer with poison, not guesswork: an env-gated frame-fill knob
(`SLANG_VM_FRAME_FILL`) plus overlap instrumentation and a full disasm proved the
x86_64-emitted byte-code executes correctly regardless of frame garbage — refuting
the "VM reads uninitialized memory → zero-init fixes it" root cause. Whole-process
valgrind (`--track-origins=yes`) sees compile/emit-time C++ locals a VM-only poison
can't, but a valgrind hit is a candidate, not a confirmed cause (check for
short-circuiting). The PR's own aarch64 CI legs are the verification oracle you lack
locally; open a DRAFT PR (Fixes-held) and read the aarch64 leg rather than shipping
unproven. And restoring a KNOWN-RED test *enabled* makes the PR permanently
unmergeable — keep the file but `//DISABLE_TEST:` it with a tracking-issue
breadcrumb
([handling aarch64-only compiler miscompiles from an x86_64-only coworker](../learnings/1788542612503-handling-aarch64-only-compiler-miscompiles-from-an.md)).
Do not over-weight whichever hypothesis your one arch's experiments happen to touch;
the codex-forced hedge "runtime not excluded" was the correct posture, and the
handoff to aarch64 hardware was vindicated
([resolved: signed→unsigned cast, not emit divergence](../learnings/1788888872953-resolved-aarch64-ifloat-neg-0-0-was-a-signed-unsig.md)).
Correspondingly, a code-path-level "different mechanisms" argument does NOT establish
"not a dup" at the root-cause level — the two are different claims, the second needs
a repro. The triager hedged in its reasoning ("may be a different instance") but the
bottom-line bullet said "NOT a dup" confidently, and that confident label got
relayed and later reversed when the maintainer's aarch64 repro closed #12891 as a
dup of #12871
([dedup/root-cause classification without a repro is provisional](../learnings/1788538710735-dedup-root-cause-classification-without-a-repro-is.md)).

## Consumer-side sibling: slangi printf reads double as float

`slangi` prints a `double` wrong for plain `%f`/`%e`/`%g` (reads its low 4 bytes as
a `float`); `%lf`/`%le`/`%lg` and `float` args work. The operand IS correctly sized
end-to-end — `slang-emit-vm.cpp` sizes each Print operand by IR type and
`printHandler` copies exactly `arg.size` bytes — but `printHandler` passes only
*pointers* to `makeStringWithFormatFromArgArray`, which picks read-width from the
FORMAT SPEC (plain e/f/g → `readValue<float>`). This is the consumer-side variant of
the emitter/validator operand-width bug family; Slang does NOT do C-style
float→double promotion for printf (variadic via generic type packs, args keep
declared types), so a `double` is a genuine 8-byte operand. The principled fix
sources read-width from the argument's actual operand width; naively making plain
e/f/g always `readValue<double>` regresses `%f`+float (over-reads a 4-byte operand)
([slangi printf reads double as float — consumer-side variant of the VM operand-width bug family](../learnings/1788892011702-slangi-printf-reads-double-as-float-consumer-side-.md)).
When reviewing such a fix, apply the **revert drill** to the NEW test: for top-level
scalar args, `allocReg` already sets `operand.size` to the natural width, so an
emitter-side `.size` pin is a no-op for them — a test printing only plain locals
passes with the pin reverted. The pin only matters for operands from
`kIROp_FieldExtract` / constant-index `kIROp_GetElement` (aliased operands that keep
the enclosing aggregate's `.size`), so the real guard is a *different* pre-existing
test (`tests/byte-code/bwd-diff-call-arg-oob.slang`, printing a `float` field of a
`DifferentialPair`). Coverage must print a struct field / array element, not a
top-level scalar
([slangi VM printf fixes: new regression test can pass without guarding the emitter-side operand-size change](../learnings/1788902064424-slangi-vm-printf-fixes-new-regression-test-can-pas.md)).

## Keyword hygiene coda

Only carry `Fixes #N` once the fix is verified: #12871's PR cycled
`Fixes`→(unverified)→`Related to`→(maintainer-verified)→`Fixes` again, and the
re-enabled known-red test going GREEN on the target-arch CI leg was the positive
end-to-end proof
([resolved: signed→unsigned cast](../learnings/1788888872953-resolved-aarch64-ifloat-neg-0-0-was-a-signed-unsig.md)).
(The GitHub auto-close negation trap that governs `Related to` vs `Fixes` wording
lives in the GitHub-process page.)

**Source learnings (9):**

- [-cpu/host-callable and slangi/HostVM are distinct emit paths; PathInfo::type UB fix is HostVM-only](../learnings/1788383948543-cpu-host-callable-and-slangi-hostvm-are-distinct-e.md) — verify at the code that a "bug X also affects target Y" claim actually exercises the same path before assuming a pending fix covers it.
- [Dedup/root-cause classification without a repro is provisional — a maintainer's repro can reverse a confident "not a dup"](../learnings/1788538710735-dedup-root-cause-classification-without-a-repro-is.md) — a code-path argument ≠ a root-cause dedup; watch the gap between hedged reasoning and an over-confident summary bullet.
- [Handling aarch64-only compiler miscompiles from an x86_64-only coworker](../learnings/1788542612503-handling-aarch64-only-compiler-miscompiles-from-an.md) — poison-not-guesswork, whole-process valgrind, the PR's own arch CI leg as oracle, disable (don't remove) known-red tests.
- [RESOLVED: aarch64 IFloat neg() 0/0 was a signed→unsigned cast bug, not emit divergence](../learnings/1788888872953-resolved-aarch64-ifloat-neg-0-0-was-a-signed-unsig.md) — the interpreter mapped signed ints through unsigned C++ types; fcvtzu saturates negatives to 0 while cvttss2si is accidentally correct.
- [Arch-only wrong result from (int)float? Suspect the cast, not your computation](../learnings/1788889922238-arch-only-wrong-result-from-int-float-suspect-the-.md) — change format to %f to isolate computation vs cast; check the cast handler routes signed ints through signed C++ types.
- [slang#12871 host-VM PathInfo::type UB is NOT the aarch64 0-0 root cause — corrected by #12879 CI evidence](../learnings/1788889414933-approver-challenger-note-slang-12871-host-vm-pathi.md) — a short-circuiting && forces the predicate false regardless of the uninitialized value; demand before/after on the symptom platform.
- [slang#12871 true root cause = signed-int cast UB in byte-code interpreter](../learnings/1788906006649-approver-challenger-note-slang-12871-true-root-cau.md) — the Step-0 recall signal, plus the positive-exemplar test that routes casts through opaque helpers to defeat the byte-identical-no-op trap.
- [slangi printf reads double as float — consumer-side variant of the VM operand-width bug family](../learnings/1788892011702-slangi-printf-reads-double-as-float-consumer-side-.md) — the formatter picks read-width from the format spec, discarding the correctly-sized operand width; source read-width from the operand instead.
- [slangi VM printf fixes: new regression test can pass without guarding the emitter-side operand-size change](../learnings/1788902064424-slangi-vm-printf-fixes-new-regression-test-can-pas.md) — the emitter `.size` pin is a no-op for top-level scalars; the real guard prints a struct field via FieldExtract/GetElement.
