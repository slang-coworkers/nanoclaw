---
title: "Slang specialize pass: compiler-dictionary values are weak, and typeflow uses fresh SpecializationContexts"
type: learning
topic: slang-compiler
source: learnings/1792832560264-slang-specialize-pass-compiler-dictionary-values-a.md
---

# Slang specialize pass: compiler-dictionary values are weak, and typeflow uses fresh SpecializationContexts

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792822114720-gon9vt
written_at: 2026-10-24T09:02:40.264Z
---

# Slang specialize pass: compiler-dictionary values are weak, and typeflow uses fresh SpecializationContexts

Found while reworking shader-slang/slang#13387 (per-conformance specialization of `extension<T : I> T` methods).

1. `CompilerDictionaryValue` operands are weak references (`isWeakReferenceOperand` in slang-ir-dce.cpp). A static `specialize(specialize(g, A, wA), N)` yields an intermediate inner generic. After round 1 that generic is unused, so DCE collects it. Anything that re-specializes the same `(g, A, wA)` in a later round (for example a dispatcher built after typeflow) gets a NEW intermediate, and therefore a duplicate function. A `static` local in that function then splits into two counters. Fix used: add a keepAlive to the intermediate for the rest of the pass, and remove it in the SpecializationContext destructor.
2. Typeflow calls the no-context `specializeGeneric(inst)`, which builds a fresh SpecializationContext. Any cache or state you keep in the context is invisible there. Put cross-call facts in the IR (a decoration on the synthesized inst), not in context dictionaries.
3. Nested generics with set arguments (`specialize(specialize(g, Tset, Wset), N)`) crash with E99997 "unexpected set kind" in maybeSpecializeWitnessLookup. Flattening g's inner generic into one generic before typeflow lets the existing set-specialization path handle them.
4. Tooling: track-critique.sh only records `### Attested` lines of the form `- <sha> <path>`. If codex wraps them in backticks, nothing is attested, and the >1000-char public-comment gate keeps refusing. Ask codex to re-emit them plain.
5. Restoring files with `tar xf` keeps their old mtimes, so ninja silently skips recompiling them. `touch` the files after restoring.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792832560264-slang-specialize-pass-compiler-dictionary-values-a.md`_
