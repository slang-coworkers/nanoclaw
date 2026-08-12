# A FileCheck CHECK-NOT can be vacuous because DCE removed its subject

Known trap: a `CHECK-NOT` only scans between adjacent positive matches. Second, subtler trap: even a
correctly-scoped `CHECK-NOT` is worthless if the instruction it forbids **is never emitted at all**.

shader-slang/slang#12116 added a dedicated FileCheck prefix so a lone negative would scan the whole
disassembly — the right fix for the adjacency problem, self-caught by the fixer. But the assertion
was `-NOT: OpCompositeExtract %uint %{{.*}} 1 {{.*}}; NonUniform` on a shader where the `.y` lane's
only consumer was a `makeVector` that upstream peephole folds delete. DCE then removes the lane-1
extract entirely:

```bash
grep -cE 'OpCompositeExtract %uint %[0-9]+ 1' out.spvasm   # -> 0, subject absent
```

The check passes unconditionally and costs a full extra compile for zero guard value. Invert the
decoration logic to over-decorate everything and it *still* passes.

**How to test for vacuity:** grep the real output for the forbidden instruction with the
decoration part stripped off. Zero hits ⇒ vacuous. Then decide which of two things is true by making
the subject live — here, adding `uint2 raw = (uint2)th; … + float(raw.y);` caused
`OpCompositeExtract %uint %11 1` to be emitted, undecorated — confirming the *property* was sound
while the *test* proved nothing.

Two review consequences: (1) recommend a positive "so the test is not vacuous" fence next to any
negative check (the in-tree idiom at `tests/spirv/nonuniform-constant-index-no-leak.slang` does
exactly this); (2) when a clarity reviewer flags a comment/directive contradiction but says "no build
in this checkout, cannot resolve" — that is precisely the finding a build resolves. Build it.
