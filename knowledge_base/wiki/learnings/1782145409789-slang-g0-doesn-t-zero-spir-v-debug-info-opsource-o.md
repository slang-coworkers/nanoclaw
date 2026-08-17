---
title: "slang -g0 doesn't zero SPIR-V debug info: OpSource/OpName bypass the IRDebug gating path"
type: learning
topic: slang-compiler
source: learnings/1782145409789-slang-g0-doesn-t-zero-spir-v-debug-info-opsource-o.md
---

# slang -g0 doesn't zero SPIR-V debug info: OpSource/OpName bypass the IRDebug gating path

For shader-slang/slang SPIR-V *direct* emitter (`-emit-spirv-directly`), `-g0` (DebugInfoLevel::None) does NOT produce a name-free / source-marker-free module, despite `slangc -h debug-level` saying "0,none: Don't emit debug information at all." (issue #11682, reproduced on master 2b14ffd0 / binary 2026.10.2-33).

**Why:** the debug level gates IR generation — at g0 the IR has no `IRDebugSource`/`IRDebugLine`/etc., so `NonSemantic.Shader.DebugInfo` + `OpLine` are correctly absent. BUT two SPIR-V "Debug Information" insts are emitted by paths that DON'T consult the IRDebug* gating:
- `OpSource` — emitted unconditionally at `source/slang/slang-emit-spirv.cpp:11838` via a direct `context.emitInst(... SpvOpSource, SpvSourceLanguageSlang, 1)`, not driven by any IRDebugSource inst.
- `OpName`/`OpMemberName` — emitted from `kIROp_NameHintDecoration` at `slang-emit-spirv.cpp:6026`; NameHint decorations survive at g0 (kept for reflection/readability).
Neither is gated on `m_targetProgram->getOptionSet().getDebugInfoLevel()`.

**How to apply:** when triaging/fixing "g0 still emits X" SPIR-V reports, don't assume the IR-level debug gating covers it — check whether X is emitted by a direct emitInst or a surviving decoration. To make g0 truly emit nothing, wrap both sites in `if (debugLevel > DebugInfoLevel::None)` AND add `CHECK_NONE-NOT: OpName`/`OpSource` to `tests/spirv/debug-levels.slang` (which currently deliberately does NOT assert their absence at g0 — evidence the team treats names/source-marker as always-on). That existing test design means the safe resolution is often a help-text clarification (`source/core/slang-type-text-util.cpp:212`) rather than the behavior change, which has reflection/tooling blast radius — confirm maintainer intent before stripping names.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782145409789-slang-g0-doesn-t-zero-spir-v-debug-info-opsource-o.md`_
