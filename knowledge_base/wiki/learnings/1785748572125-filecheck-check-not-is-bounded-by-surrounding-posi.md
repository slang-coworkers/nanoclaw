---
title: "FileCheck CHECK-NOT is bounded by surrounding positive CHECKs — a lone-prefix negative is the only whole-output assertion"
type: learning
topic: misc
source: learnings/1785748572125-filecheck-check-not-is-bounded-by-surrounding-posi.md
---

# FileCheck CHECK-NOT is bounded by surrounding positive CHECKs — a lone-prefix negative is the only whole-output assertion

# `CHECK-NOT` scans only the gap between adjacent positive matches

Standard LLVM FileCheck semantics, easy to get wrong in Slang tests and **silently produces an
assertion that can never fail**.

A `CHECK-NOT` directive constrains only the region **between the previous positive match and the
next positive match**. It is not a whole-file assertion unless nothing bounds it.

```
// P1: OpCapability ShaderNonUniform          <- matches near line 7
// P1-NOT: OpCompositeExtract %uint %{{.*}} 0 {{.*}}; NonUniform
```
If the forbidden line appears *before* the `OpCapability` match, or after a later positive `CHECK`,
the `-NOT` never sees it. Observed on slang `desc-heap-nonuniform-spirv.slang`: a trailing
`SPVNONCONST-NOT` after two positive CHECKs was scanning only 6 remaining lines — one
`OpCompositeExtract %float`, so a `%uint` pattern could not possibly fire. Moving it *first* did not
fix it either: it was then bounded by the next positive CHECK.

**The fix: give the negative its own FileCheck prefix**, with no positive directives to bound it.

```
//TEST:SIMPLE(filecheck=SPVNONCONST):        -target spirv-asm -entry mainNonConstSibling
//TEST:SIMPLE(filecheck=SPVNONCONSTSIBLING): -target spirv-asm -entry mainNonConstSibling
...
// SPVNONCONST: %[[IDX:[0-9]+]] = OpCompositeExtract %uint %{{.*}} 0 {{.*}}; NonUniform
// SPVNONCONST: OpAccessChain %{{.*}} %__slang_resource_heap %[[IDX]] {{.*}}; NonUniform

// lone -NOT under its own prefix -> scans the entire disassembly
// SPVNONCONSTSIBLING-NOT: OpCompositeExtract %uint %{{.*}} 1 {{.*}}; NonUniform
```
Costs one extra `//TEST:` line (same entry point, same flags) and the negative becomes real.

## ALWAYS negative-control a new FileCheck assertion

The general lesson: a passing FileCheck test proves nothing until you've seen it fail. Flip the
pattern to something you *know* is present and confirm the test goes red:

```bash
cp $T /tmp/sav.slang
sed -i 's|-NOT: ...lane 1...|-NOT: ...lane 0...|' $T   # lane 0 IS emitted
./build/Debug/bin/slang-test $T | grep -E "% of tests|FAILED"   # MUST fail
cp /tmp/sav.slang $T
```
Two of my controls were themselves vacuous before I found a valid one — verify the control edited
the file (`diff` it) and that the flipped pattern really exists in the output.

Related known-inert modes in this repo: FileCheck absent → `filecheck=` tests report
`TestResult::Ignored`, not failed (`slang-test-main.cpp:818` — "Ignore if FileCheck is not
available"), so a whole suite can look green while asserting nothing; and `DIAGNOSTIC_TEST`
`//CHECK-NOT:` is inert because diagnostics are exhaustive-by-default.

## Bonus, same session: proving IR-pass code is dead

To show removing a peephole/float-pass case is a true no-op, don't diff decoration *counts* — dump
`-target spirv-asm` for every entry point before and after and `diff` the files. Byte-identical
output across all entry points is a much stronger claim than matching totals, and it's cheap.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785748572125-filecheck-check-not-is-bounded-by-surrounding-posi.md`_
