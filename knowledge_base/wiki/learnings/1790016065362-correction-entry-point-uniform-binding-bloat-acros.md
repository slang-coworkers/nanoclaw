---
title: "CORRECTION: entry-point uniform binding 'bloat' across multiple entry points IS real in combined slangc emit"
type: learning
topic: slang-compiler
source: learnings/1790016065362-correction-entry-point-uniform-binding-bloat-acros.md
---

# CORRECTION: entry-point uniform binding "bloat" across multiple entry points IS real in combined slangc emit

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790010356260-j7u8a8
written_at: 2026-09-21T18:41:05.362Z
---

# CORRECTION: entry-point uniform binding "bloat" across multiple entry points IS real in combined slangc emit

**Scopes/corrects the earlier learning "Entry-point uniform reflection offsets are scope-relative … no binding 'bloat'" (triage #13203).** The reflection half of that learning is correct (leaf offsets are scope-relative; `isParameterLocationUsed` needs the absolute location = add `EntryPointReflection::getVarLayout()->getOffset(category)` = `calculateCumulativeOffset`; that workaround is the right way to *read* the current layout). But its "no binding bloat" conclusion was WRONG/incomplete.

**Maintainer tangent-vector (authoritative, #13203 cmt 5765548497) corrected it:** the "bloat" is real in terms of the ABSOLUTE offsets that land in the emitted SPIR-V/DXIL when a single `slangc` invocation compiles MULTIPLE entry points (targets where entry-point uniforms aren't scoped to the entry point). My earlier "no bloat" only held because I tested *per-entry-point separate* emit (each resets to b0/t0/u0). The COMBINED whole-program emit accumulates.

**Empirical (GPU-free, both compute entry points in ONE slangc invocation):**
- SPIR-V: EP1 → binding 0/1/2 (set 0); EP2 → **binding 3/4/5** (set 0).
- HLSL: EP1 → b0/t0/u0; EP2 → **b1/t1/u1**.
- ⇒ N compute entry points × O(k) uniform params → max absolute binding O(N·k). Maintainer's baseline: it should be O(k); the current default slangc behavior for a compute-only file is **wrong** (principle of least surprise).

**Design tension (why it's unresolved):** "do what I mean" is hard — 10 compute EPs likely want per-EP reset; a VS+FS pair may want NO reset (or a shared prefix); 3 VS + 5 FS want grouping to mix-and-match; RT/mixed pipelines get messy. The C++ API lets users link their own compositions (link one entry point at a time ⇒ no bloat) but that's no panacea and doesn't solve the slangc default. Likely needs a new compiler option / language feature / composition-based control.

**Triage takeaway:** treat "multiple entry points → binding indices grow with entry-point count" as a REAL design issue (not not-a-bug). No dedicated tracking issue existed as of 2026-09-21 (#13203 is now it; related-distinct #6672 auto-binding-space+DCE-gap-shift, #5723 explicit binding on entry-point params/backlog, #5685 reflection push-constant used-ness). Verify with `slangc -target spirv-asm` / `-target hlsl` on the WHOLE file (no -entry) and compare each entry point's OpDecorate Binding / register().

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790016065362-correction-entry-point-uniform-binding-bloat-acros.md`_
