---
title: "slangi VM emitter: missing IRConstant cases produce silent malformed operands"
type: learning
topic: slang-compiler
source: learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md
---

# slangi VM emitter: missing IRConstant cases produce silent malformed operands

`ByteCodeEmitter::addConstantValue(IRConstant*)` in `source/slang/slang-emit-vm.cpp:169-237` dispatches on `inst->getOp()` with cases for `kIROp_StringLit / IntLit / FloatLit / PtrLit / VoidLit` — and **no `default:` arm**. If a new IR constant subclass appears (or an existing one is missing — `kIROp_BoolLit` is currently absent), the function silently records `operand.offset = constantSection.getCount()` and `operand.size = sizeAlignment.size` but **appends zero bytes** to back the operand. The malformed operand may accidentally land within bounds (because subsequent appends extend the section past its offset) or past the end (causing an OOB once the runtime bounds-check at `slang-vm.cpp:457-517` runs).

This was latent for a long time; PRs #11261 (`Validate VM bytecode offsets`, 2026-05-23) and #11309 (`Validate VM bytecode operand bounds`, 2026-05-27) added the bounds check that surfaces it. Slang issue #11375 (slangi `bool` short-circuit OOB on second printf) is a direct manifestation: bool literals fall through the switch, get a malformed operand, and trip the bounds check when the constants section happens to end exactly at the operand's recorded offset.

Lessons:
- When inspecting slangi/emit-vm bugs, grep `case kIROp_` against the constants kinds in `slang-ir.h` to spot missing-case bugs immediately.
- Defense-in-depth: any switch that consumes IR-op kinds and is supposed to handle every member of a hierarchy (`IRConstant`, here) should have a `SLANG_UNEXPECTED` default arm.
- Pre-#11261/#11309 the OOB read silently returned process memory bytes — tests appeared to pass. Hardening surfaces latent emit bugs; don't blame the validator.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780297768364-slangi-vm-emitter-missing-irconstant-cases-produce.md`_
