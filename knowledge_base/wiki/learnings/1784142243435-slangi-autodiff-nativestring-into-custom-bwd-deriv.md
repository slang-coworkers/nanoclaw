---
title: "slangi autodiff NativeString into custom bwd derivative → constants-OOB (LIVE at HEAD, #12124)"
type: learning
topic: slang-compiler
source: learnings/1784142243435-slangi-autodiff-nativestring-into-custom-bwd-deriv.md
---

# slangi autodiff NativeString into custom bwd derivative → constants-OOB (LIVE at HEAD, #12124)

**Issue:** shader-slang/slang#12124. A `[Differentiable]` fn calling a fn with a user `[BackwardDerivativeOf]` that takes a non-differentiable `NativeString` arg → slangi bytecode VM exits code 5: `VM operand access out of bounds in constants section: offset=N size=4 sectionSize=N` (offset == section length = one-past-end). Repro is GPU-free (`slangi square-debug.slang`), reproduce with `-disasm`.

**Two-layer root cause (verified by Read at HEAD 694022a11):**
- PRODUCER (root): `canTypeBeStored()` in `slang-ir-autodiff.cpp:993` returns `false` for `NativeString` (hits `default:` — only basic types + an enumerated struct/vector/context set are storable). So reverse-mode autodiff can't thread the non-diff string through the intermediate/minimal context. `transposeCall` (`slang-ir-autodiff-transpose.cpp:1256`) then builds the backward-prop call reading a context field that was never stored. Forward pass by contrast passes the non-diff primal arg DIRECTLY (`slang-ir-autodiff-fwd.cpp:1511` `args.add(primalArg)`), which is why the primal call correctly emits `str:"y2"`.
- CONSUMER (symptom): the un-stored arg reaches the VM emitter as an `IRConstant` that is NOT a direct `IRStringLit`, so it falls through the `switch` in `addConstantValue` (`slang-emit-vm.cpp:174-242`), which set `operand.offset = constantSection.getCount()` BEFORE the switch and appends nothing for unhandled ops → dangling `const:` at section end. Same "missing switch arm → one-past-end operand" family as #11375, but reached via a different producer.

**Recommended fix (producer-side, principled):** in `transposeCall`, re-materialize the non-differentiable primal arg from its original IR value directly into the backward call (mirror the forward pass), so the emitter sees the original `IRStringLit` and emits `str:`. A defensive missing-case assert in `addConstantValue` makes this class fail loud, but is NOT the fix on its own.

**Method lesson (the big one):** the reporter said "a newer local slangi already works" and asked whether it was already fixed after v2026.12. DON'T take that at face value — I rebuilt slangi at TRUE HEAD and it STILL reproduced identically. A reporter's "newer build works" is not authoritative about upstream `master`; always rebuild-and-run at HEAD before concluding "already fixed / regression-test-only". slangi bytecode-VM bugs are fully reproducible locally with no GPU — always repro them directly rather than triaging from the description.

**Dedup:** #11463/#11399 (printf `%s` string-literal) CLOSED and in-tree; #11375 OPEN shares the OOB symptom but roots in missing BoolLit serialization — distinct path.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784142243435-slangi-autodiff-nativestring-into-custom-bwd-deriv.md`_
