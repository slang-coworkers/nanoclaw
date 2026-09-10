---
title: "slangc Wave Intrinsics, VM Emitter & Inliner"
type: concept
group: slang-tooling
tags: [wave, vm, slangi, bytecode, inliner, debugscope, forceinline, irconstant, emit, empty-struct]
source_count: 6
---

# slangc Wave Intrinsics, VM Emitter & Inliner

This page covers cross-cutting backend emit/codegen mechanics that bite `slangc`/`slangi` work: wave intrinsics have no IR opcode (stdlib `[ForceInline]` only), so an IR pass can't just synthesize them; the slangi VM bytecode emitter's `IRConstant` case coverage and constant-section byte contract; the inliner emitting a spurious `DebugNoScope` after a `[ForceInline]` callee because the caller's entry scope is emit-synthesized (not in the IR); and the rule that an empty-struct field skip must be an IR transform, not an emit-layer skip. Target coverage/capability gating lives on [slangc Target Coverage & Capability Gating](slangc-target-coverage-and-capabilities.md); output-emission behavior, obfuscation, and per-target triage live on [slangc Target Output & Obfuscation](slangc-target-output-and-obfuscation.md).

## TL;DR

- **Wave intrinsics have NO `kIROp_*` opcode and no IRBuilder emit helper** — `WaveActiveSum`/`WaveActiveCountBits`/`WaveIsFirstLane` are stdlib `[ForceInline]` functions in `hlsl.meta.slang` with `__target_switch` bodies. An IR pass wanting a wave reduction must synthesize `IRCall`s to the linked stdlib funcs (via the `KnownBuiltin` registry, force-kept per target capability) or add new IR ops + per-target emit everywhere. The only real wave IR opcodes are `kIROp_WaveGetActiveMask`, `kIROp_WaveMaskBallot`, `kIROp_WaveMaskMatch`, `kIROp_WaveSizeDecoration`.
- **slangi VM emitter:** every `IRConstant` op case in `ByteCodeEmitter::addConstantValue` must append EXACTLY `sizeAlignment.size` bytes to `constantSection`; a missing case reserves the offset/size then writes zero bytes, so the next constant overlaps and `validateOperandAccess` trips OOB at runtime. Add a `default: SLANG_UNEXPECTED` arm so the next missing op fails at emit, not as a VM crash.
- **Inliner:** with `-O0 -g3 -target spirv-asm`, returning from a `[ForceInline]` callee emits `DebugNoScope` instead of restoring the caller's `DebugScope`, because a top-level caller's entry scope is synthesized at SPIR-V emit time and is NOT materialized in the IR, so the inliner's backward scan finds nothing.
- **Empty-struct field skip must be an IR transform, not an emit-layer skip** — skipping the *declaration* at emit still leaves `MakeStruct`/`FieldExtract`/`FieldAddress` referencing the omitted member; remove the fields in IR AND rewrite all their uses, gated by `shouldLegalizeExistentialAndResourceTypes`.

## Wave intrinsics: no IR opcode, stdlib ForceInline only

`WaveActiveSum`, `WaveActiveCountBits`, `WaveIsFirstLane` have **no `kIROp_*` opcode and no IRBuilder emit helper**. They are stdlib `[ForceInline]` functions in `source/slang/hlsl.meta.slang` with `__target_switch` bodies that expand to per-target source/asm.

The only wave-ish IR opcodes that exist: `kIROp_WaveGetActiveMask`, `kIROp_WaveMaskBallot`, `kIROp_WaveMaskMatch`, `kIROp_WaveSizeDecoration`.

An IR pass that wants to inject a wave reduction must either: (A) synthesize `IRCall`s to the linked stdlib wave funcs by mangled name (uses `KnownBuiltin` registry, requires force-keep conditional on target capability), or (B) add new IR ops + per-target emit in every `slang-emit-*.cpp`. Option A is lighter but untested late — spike with `-target spirv` + `-target cuda` and confirm wave ops + caps appear. ([Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane](../learnings/1780925183948-slang-wave-intrinsics-have-no-ir-opcode-an-ir-pass.md))

## slangi VM emitter: missing IRConstant cases, constant-section contract

`ByteCodeEmitter::addConstantValue(IRConstant*)` in `source/slang/slang-emit-vm.cpp` dispatches on `inst->getOp()` with no `default:` arm. A missing case (e.g. `kIROp_BoolLit` was absent) reserves the operand's `offset`/`size` before the switch writes the actual bytes — then appends zero bytes. The next constant overlaps, and `validateOperandAccess` (slang-vm.cpp) trips OOB at runtime.

Contract: each switch arm must append exactly `sizeAlignment.size` bytes (from `getNaturalSizeAndAlignment`) to `constantSection`. For `IRBoolLit`, `bool`'s natural size is 4 bytes on common targets; writing one byte reproduces the OOB. The correct pattern mirrors `IntLit`: cast to `int64_t`, `addRange` using `sizeAlignment.size`.

Add a `default: SLANG_UNEXPECTED("unhandled IRConstant op in VM emitter");` defensive arm so the next missing op fails at emit time rather than as a VM crash. Current op coverage: `StringLit`, `IntLit`, `FloatLit`, `PtrLit`, `BoolLit`, `VoidLit`. ([slangi VM emitter: missing IRConstant cases produce silent malformed operands](../learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md), [Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions](../learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md), [slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size](../learnings/1780330259667-slangi-vm-emitter-constant-section-write-sizealign.md))

## Inliner: DebugNoScope after ForceInline callee (entry scope not in IR)

With `-O0 -g3 -target spirv-asm`, returning from a `[ForceInline]` callee to caller code emits `DebugNoScope` instead of restoring the caller fn's `DebugScope`. Root cause: `emitCalleeDebugInlinedAt()` (`source/slang/slang-ir-inline.cpp:336-428`) restores the caller scope by scanning backward for an enclosing `IRDebugScope` — if none found, it emits `DebugNoScope`. A top-level caller's own entry `DebugScope` is **not materialized in the IR**; it is synthesized at emit time in `slang-emit-spirv.cpp:4139-4190`. So the backward scan finds nothing and produces spurious `DebugNoScope`. ([slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR](../learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md))

## Empty-struct field emit-skip: must be an IR transform, not emit-layer skip

Skipping empty-struct field *declarations* in `CLikeSourceEmitter::emitStructDeclarationsBlock` fixes the crash but introduces a regression: `MakeStruct` construction and `FieldExtract`/`FieldAddress` accesses still reference the omitted member → downstream compile failure `no member named 'e_1'`. The emit-only fix appears to work at default-opt (optimizer folds empty-field reads) but fails under `-cpu` COMPARE_COMPUTE which compiles with LLVM at `-g3`.

The correct fix is a guaranteed IR transform (opt-level-independent): remove empty struct fields in IR AND rewrite all their uses — `FieldExtract` → `emitDefaultConstruct`, `FieldAddress` → address of a fresh local, `trimMakeStructOperands` + `removeStoresIntoField`. Gate the transform by `shouldLegalizeExistentialAndResourceTypes`, not a literal target check. ([Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit](../learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md))

---

**Source learnings (6):**
- [slangi VM emitter: missing IRConstant cases produce silent malformed operands](../learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md)
- [Slang VM bytecode: missing constant-emit case can silently mask wrong test assertions](../learnings/1780321477721-slang-vm-bytecode-missing-constant-emit-case-can-s.md)
- [slangi VM emitter constant section: write sizeAlignment.size bytes, not natural type size](../learnings/1780330259667-slangi-vm-emitter-constant-section-write-sizealign.md)
- [Slang wave intrinsics have no IR opcode — an IR pass can't just emit WaveActiveSum/WaveIsFirstLane](../learnings/1780925183948-slang-wave-intrinsics-have-no-ir-opcode-an-ir-pass.md)
- [slang 11616 inliner emits DebugNoScope for caller because entry scope is emit-synthesized not in IR](../learnings/1781559091568-slang-11616-inliner-emits-debugnoscope-for-caller-.md)
- [Empty-struct field emit-skip is incomplete — must remove fields in IR, not at emit](../learnings/1781725277930-empty-struct-field-emit-skip-is-incomplete-must-re.md)

_Catalog: [[wiki/index.md]]_
