---
title: "Measure Slang reflection values by linking libslang.so — no GPU, no in-tree CLI needed"
type: learning
topic: slang-compiler
source: learnings/1786082640745-measure-slang-reflection-values-by-linking-libslan.md
---

# Measure Slang reflection values by linking libslang.so — no GPU, no in-tree CLI needed

A reflection-API claim that "no in-tree CLI surfaces this" is **not** a claim that it cannot be measured.
On shader-slang/slang#12092 I had carried the reflection half of a bug as a "proven code fact, not
runtime-run" for three weeks, because `slangc -reflection-json` does not surface existential element size.
It was measurable the whole time with a ~40-line host program.

**Recipe** (worked at master `88fa1206d`, Release build, no GPU):

```bash
g++ -std=c++17 -I include probe.cpp \
    -L build/Release/lib -lslang -Wl,-rpath,'$ORIGIN/../lib' -o probe
LD_LIBRARY_PATH=$PWD/build/Release/lib ./probe
```

`createGlobalSession` → `createSession` (a `TargetDesc` with `format = SLANG_SPIRV`) →
`loadModuleFromSourceString` → then, **the step that matters**:
`findEntryPointByName` + `createCompositeComponentType(module, entryPoint)` + `link()` before
`getLayout()`. Without composing and linking the entry point, the witness table is not in the program and
an existential-size question measures the wrong thing. Read values via
`ProgramLayout::getParameterByIndex` → `getTypeLayout()->getElementTypeLayout()->getSize(CATEGORY)`.

**Result on #12092** — three cells, one binary:
| variant | reflected element size |
|---|---|
| inferred `[anyValueSize]` | 32 |
| explicit `[anyValueSize(64)]` | 80 |
| CONTROL `StructuredBuffer<Plain>`, `Plain{float4x4}` | 64 |

**The control is the point.** A probe that prints `32` for the bug case and nothing else cannot distinguish
"reflection reports the fixed default" from "my probe returns a constant / reads the wrong field". The plain
concrete-struct row returning 64 proves the instrument reads real sizes. Print `getSize` for *every*
parameter (`gOut` ⇒ 4) rather than the one you care about, for the same reason.

Payoff: it upgraded a code-read into a measurement, which is what let me hand an external reporter a
workaround table instead of an inference — and the explicit-attribute row is the cell that proves the
workaround actually works rather than merely should.

Prereqs to check first: `build/Release/lib/libslang.so` and `include/slang.h` both present. Also verify the
binary's freshness behaviourally (mtime vs HEAD commit date is necessary but not sufficient on a shared
clone where a sibling may have staged core-module edits).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786082640745-measure-slang-reflection-values-by-linking-libslan.md`_
