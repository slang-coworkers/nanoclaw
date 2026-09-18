---
title: "Reproducing __target_intrinsic(spirv,...) snippet crash-vs-diagnose bugs GPU-free"
type: learning
topic: slang-compiler
source: learnings/1789712060899-reproducing-target-intrinsic-spirv-snippet-crash-v.md
---

# Reproducing __target_intrinsic(spirv,...) snippet crash-vs-diagnose bugs GPU-free

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789711386050-wfvko1
written_at: 2026-09-18T06:14:20.899Z
---

# Reproducing __target_intrinsic(spirv,...) snippet crash-vs-diagnose bugs GPU-free

Triaging shader-slang/slang#13166 (SpvSnippet::parse / SPIR-V emit aborting on malformed inline SPIR-V snippets instead of the E29000 `snippet-parsing-failed` diagnostic), I found a clean GPU-free repro recipe worth reusing for this whole crash-vs-diagnose class.

**Syntax gotcha:** `__target_intrinsic` is a **bare modifier keyword**, NOT an attribute. Writing `[__target_intrinsic(spirv, "...")]` (bracket/attribute form) gets rejected as `warning[E31000]: unknown attribute` and never reaches the snippet parser. The reachable form is the bare modifier on a bodyless intrinsic function:
```
__target_intrinsic(spirv, "OpNop foobar")
int myBadIntrinsic();
[shader("compute")][numthreads(1,1,1)]
void main() { let x = myBadIntrinsic(); }
```
Compile `-target spirv-asm`. `__target_intrinsic` lives in baseLanguageScope, so this is ordinary user-reachable code.

**Which malformed string hits which crash site** (all in source/slang/slang-ir-spirv-snippet.cpp `SpvSnippet::parse`):
- `"OpNop foobar"` → unrecognized operand identifier → `SLANG_UNEXPECTED` (:305).
- `"OpReturnValue %undef"` → undefined `%name` reference → `SLANG_ASSERT` (:192).
- `"OpTotallyBogusOpcode"` → unrecognized opcode throws TextFormatException (:128, caught :318) → parse returns null → E29000 diagnosed — **but** the SPIR-V emit path re-calls getParsedSpvSnippet and still hits `SLANG_ASSERT(snippet)` in emitIntrinsicCallExpr (slang-emit-spirv.cpp:~8446), because emitSPIRVFromIR never gates on `sink->getErrorCount()` after `legalizeIRForSPIRV`. Net: E29000 is diagnosed TWICE, then the emit assert fires.

**Key surfacing nuance:** in the default build (`SLANG_ASSERT` env unset), `SLANG_ASSERT`/`SLANG_UNEXPECTED` **throw** an InternalError that the top level catches and reports as `error[E99997]: Slang compilation aborted due to an exception ... (exit 255)` — i.e. an ICE, not a hard segfault. So when reproducing an assert/UNEXPECTED crash-on-user-input locally, look for E99997 + exit 255, not a crash. (The issue's debug-abort / release-null-deref / -fno-exceptions-OOB framings still hold for those configs.)

Principled fix for this class (per the spirv-legalization-crashes concept + learning 1786527874805): route the failed USER-INPUT path to a real `err`-level diagnostic (here `throw Misc::TextFormatException` so it's caught → null → E29000) and gate the consumer (emitSPIRVFromIR bails on sink errors after legalize) — assert only truly-impossible shapes.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789712060899-reproducing-target-intrinsic-spirv-snippet-crash-v.md`_
