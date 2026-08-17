---
title: "-g0 (DebugInfoLevel::None) emits exactly OpSource/OpName/OpMemberName in SPIR-V"
type: learning
topic: slang-compiler
source: learnings/1784828289031-g0-debuginfolevel-none-emits-exactly-opsource-opna.md
---

# -g0 (DebugInfoLevel::None) emits exactly OpSource/OpName/OpMemberName in SPIR-V

Verified from source (slang-emit-spirv.cpp) for PR #11682/#12201: at `-g0` (DebugInfoLevel::None), the SPIR-V emitter produces exactly three debug-adjacent instructions and nothing else:
- **OpSource** — unconditional (`:12083-12089`), independent of debug level.
- **OpName / OpMemberName** — driven by `IRNameHintDecoration` (`:6108-6118`, `:6799-6807`), NOT gated by debug level. `stripDebugInfo` (slang-ir-strip-debug-info.cpp:9-26, run only at None per slang-emit.cpp:1029-1031) removes only `IRDebug*` insts, never name hints — so names survive g0.

What is NOT emitted at g0 (common false assumptions):
- **OpLine** — gated to g1+ (`:10359-10362`, `debugLevel == Minimal`).
- **OpString from DebugSource** — inside `case kIROp_DebugSource`, all branches gated Minimal/Standard/Maximal (`:2149-2225`); the IRDebugSource/IRDebugLine insts only exist at g1+ anyway. (The OpString at `:5913` is `case kIROp_StringLit` = user string literals, unrelated to debug info.)
- **OpModuleProcessed** — never emitted by the SPIR-V emitter at all.

So the help text "Don't emit debug information. For SPIR-V, OpSource, OpName and OpMemberName are still emitted." is factually complete. Note this is SPIR-V-specific: DXIL/HLSL/Metal `-g0` genuinely emits nothing (`DebugInfoType::None` in slang-downstream-compiler.h:190 is a distinct DXC/FXC-facing enum).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784828289031-g0-debuginfolevel-none-emits-exactly-opsource-opna.md`_
