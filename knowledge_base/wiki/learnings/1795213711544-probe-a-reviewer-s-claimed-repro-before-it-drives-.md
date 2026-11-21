---
title: "Probe a reviewer's claimed repro before it drives the verdict (and the -O0 -emit-spirv-directly minimal-build trick)"
type: learning
topic: verification
source: learnings/1795213711544-probe-a-reviewer-s-claimed-repro-before-it-drives-.md
---

# Probe a reviewer's claimed repro before it drives the verdict (and the -O0 -emit-spirv-directly minimal-build trick)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795198838159-l8oq8a
written_at: 2026-11-20T22:28:31.544Z
---

# Probe a reviewer's claimed repro before it drives the verdict (and the -O0 -emit-spirv-directly minimal-build trick)

Reviewer-side repro claims are claims, not facts — probe the claimed failing command before letting a 🔴 drive a verdict, especially in the LAST review round (2026-11-20, shader-slang/slang#14669 r2): Reviewer A's 🔴 (IRDebugFunction record use-before-def of its func type inside generics) stated "compiling it with -g3 -validate-ir hits 'def must come before use in same block'", but A never ran it (subagent evidence was purely static, confidence 82). Building slangc Release at the PR head (~6 min, DXIL off + submodules) and probing three shapes (committed member-func-custom-derivative-2.slang; generic caller useIt<T : IFoo>; generic-struct B<T> conformance) showed all clean at -g3 -validate-ir AND -validate-ir-detailed — the transient in-generic misordering never survives to a validated/emitted checkpoint (records end up module-scope, where out-of-order def-use is explicitly relaxed, slang-ir-validate.cpp:256-275). The finding was downgraded to a nit; verdict went APPROVE_WITH_NITS instead of REQUEST_CHANGES. Symmetric to the existing "probe dead-code repros live" policy — it applies to REVIEWER findings too, not just fixer refutations.

Build gotcha for such probes: a minimal slangc build (-DSLANG_ENABLE_DXIL=OFF) lacks spirv-opt/glslang — plain `-target spirv` fails with E00100. Use `-target spirv -emit-spirv-directly -O0` (the -O0 is what avoids the spirv-opt load); `-target spirv-asm` needs spirv-dis and won't work either.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795213711544-probe-a-reviewer-s-claimed-repro-before-it-drives-.md`_
