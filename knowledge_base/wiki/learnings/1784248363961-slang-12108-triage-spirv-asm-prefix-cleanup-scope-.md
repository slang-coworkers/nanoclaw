---
title: "slang#12108 triage: spirv_asm __-prefix cleanup — scope spans hlsl AND glsl meta.slang"
type: learning
topic: slang-compiler
source: learnings/1784248363961-slang-12108-triage-spirv-asm-prefix-cleanup-scope-.md
---

# slang#12108 triage: spirv_asm __-prefix cleanup — scope spans hlsl AND glsl meta.slang

**Issue #12108** (bot-opened follow-up to #12002/#12053, assignee+driver jkwak-work): prefix all internal `spirv_asm` result registers in `*.meta.slang` with `__` so the emitter's auto-`OpName` doesn't leak misleading user-facing-looking names into SPIR-V, plus a build assert to prevent regressions.

**Key triage value-add / gotcha:** the issue scopes only `hlsl.meta.slang` (~40 distinct un-prefixed `%names` across ~429 sites; only `%__sampled` is prefixed from #12053). But `source/slang/glsl.meta.slang` ALSO has **53 un-prefixed internal `%names` (9 distinct: %borrow %carry %discardedValue %lsb %mat %msb %result %temp %temporaries)**, zero prefixed. `core.meta.slang`/`diff.meta.slang` have none. So the proposed "*.meta.slang-wide assert (all internal spirv_asm names must be `__`-prefixed)" WILL FIRE on glsl.meta.slang's 53 sites — a complete fix must prefix glsl too, and the assert should be scoped to core-module sources so user-authored spirv_asm register names are unaffected.

**Verified at HEAD 623227f86:** auto-OpName loop is at `slang-emit-spirv.cpp:11597-11598` (`for (const auto& [name,id] : idMap) emitOpName(..., id, name);`) — line-shifted from the `:11616-11617` cited in the issue body (issues written against older master go stale on line numbers; always re-pin). The implicit OpName is a TESTED feature (`tests/language-feature/spirv-asm/opname.slang` — implicit + explicit OpName coexist), which is why emitter-level gating (Approach B) is entangled and the prefix+assert (Approach A) is the clean path.

**Ownership pattern:** jkwak-work self-`assigned` + `labeled` + `issue_type_added` + `milestoned` this bot-opened issue and the assert idea was his → maintainer-driving, STAND DOWN (no fixer dispatch per no-autofixer-on-maintainer-self-claimed directive). Triage = verified 5-bullet verdict comment only. Memo: /workspace/agent/memory/triage-12108.md.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784248363961-slang-12108-triage-spirv-asm-prefix-cleanup-scope-.md`_
