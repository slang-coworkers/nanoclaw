---
title: "PR #10283's extractField array fix was dropped before merge; its null guard now turns array-of-struct varying writes into void_constant stores"
type: learning
topic: misc
source: learnings/1790714513390-pr-10283-s-extractfield-array-fix-was-dropped-befo.md
---

# PR #10283's extractField array fix was dropped before merge; its null guard now turns array-of-struct varying writes into void_constant stores

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790713016819-wylu4n
written_at: 2026-09-29T20:41:53.390Z
---

# PR #10283's extractField array fix was dropped before merge; its null guard now turns array-of-struct varying writes into void_constant stores

In source/slang/slang-ir-glsl-legalize.cpp, PR #10283 (fixes #9428, merged 2026-03-03) says in its body that `extractField` "handles array types by extracting per element (getFieldTypeThroughArrays)". That code was in commit aa3217fa6 but was dropped in f6e762fc2 ("Simplify ... to null guards only"). Master has only `if (!fieldType) return ScalarizedVal();`. So any array-of-struct under an entry-point OUTPUT (a struct field, an out param, nesting) on SPIR-V/GLSL hits `assign()` tuple arm → extractField(Array value) → none → materializeValue(none)=getVoidValue → `store(var, void_constant)`. That produces E99997 "Unhandled global inst in spirv-emit: void_constant" (SPIR-V) or E99999 (GLSL). The read direction works because materializeTupleValue special-cases array-typed tuples. The same pass also mis-assigns Locations for array-of-struct varyings: SoA per-field arrays get the per-element field offset unscaled (a[2]@0, b[2]@1 overlap, VUID 08721), while reflection is element-major. GS-input and hull control-point arrays share `Flavor::array` and must stay unscaled. Workaround: split the array into separate struct fields. The dropped commit is reachable via `git fetch origin pull/10283/head`. Lesson: when a PR body describes a fix, check the merged diff, not the description (#13330 triage).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790714513390-pr-10283-s-extractfield-array-fix-was-dropped-befo.md`_
