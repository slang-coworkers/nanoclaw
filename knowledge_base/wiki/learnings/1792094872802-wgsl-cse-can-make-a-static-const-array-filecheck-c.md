---
title: "WGSL: CSE can make a static-const-array FileCheck case unobservable; module-scope wrappers already fail for override defaults"
type: learning
topic: slang-compiler
source: learnings/1792094872802-wgsl-cse-can-make-a-static-const-array-filecheck-c.md
---

# WGSL: CSE can make a static-const-array FileCheck case unobservable; module-scope wrappers already fail for override defaults

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792088789549-jcmfgn
written_at: 2026-10-15T20:07:52.802Z
---

# WGSL: CSE can make a static-const-array FileCheck case unobservable; module-scope wrappers already fail for override defaults

Reviewing #13670 (WGSL `_slang_nonConstU32` wrap for non-finite `unpack2x16float` literals):

1. **A test with array literals that repeat literals used elsewhere checks nothing about the array.** When `static const float k[3] = { f16tof32(0x7C00u), ... }` repeats the exact calls stored directly elsewhere in the entry point, Slang CSEs them, and the inlined array is built from the same `_S1.._S3` temporaries. Every `-DAG` line is satisfied by the direct stores, so the array path is never checked on its own. Fix: give the array distinct payloads (e.g. NaN 0x7C01/0xFC01/0x7E01). The array then emits inline with its own values. Confirm the new lines fail on a base build.

2. **The emitter already has the module-scope limitation.** Master's `[SpecializationConstant] const float k = 1.0f/0.0f;` emits `override k = _slang_getInfinity(true)`, and Tint rejects it with "user-declared functions cannot be called at module-scope". Any new prelude-fn wrapper therefore has the same issue for `override` defaults, emitted via `WGSLSourceEmitter::emitGlobalParamDefaultVal` (slang-emit-wgsl.cpp:763). Static globals are fine because they get inlined into functions. WGSL §15.7.2 makes a non-finite override-expression a pipeline-creation error anyway, so this only affects diagnostic quality.

3. **`ensurePrelude` dedup is by content in practice.** It is keyed on the `const char*`, but `IRBuilder::getStringValue` interns by content, so two PRs each defining the same prelude text emit it once.

4. **WGSL §15.7.2:** "When a runtime expression would produce an infinity or NaN, the result is an indeterminate value for the target type." For `unpack2x16float`, the target type is the whole `vec2<f32>`. Checking `.x` of a result whose other half is Inf is therefore not spec-guaranteed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792094872802-wgsl-cse-can-make-a-static-const-array-filecheck-c.md`_
