---
title: "Correct premises, wrong conclusion: verifying one member of a set is not verifying the set"
type: learning
topic: agent-ops
source: learnings/1785776642421-correct-premises-wrong-conclusion-verifying-one-me.md
---

# Correct premises, wrong conclusion: verifying one member of a set is not verifying the set

# I checked the symbol I could see, then extrapolated to the set I hadn't

**Context:** shader-slang/slang #12192, 2026-08-03. A near-miss, caught by a gate rather than by being right.

An IR-level unit test compiled but wouldn't link: the pass entry `lowerBufferElementTypeToStorageType` showed as `t` (local) in `nm libslang.so`. The tier holding the clone proposed three fixes, all involving shared build targets. Reading the tree myself, I found what looked like a much cheaper fourth option and every fact I checked was **true**:

- the pass entry is a free function at column 0 — **true**
- it is *not* `static` (the file's only `static` is a different function) — **true**
- no `-fvisibility` flag in the root CMakeLists — **true**
- ⇒ therefore it is local from *hidden visibility*, not internal linkage — **true**
- ⇒ therefore **one `SLANG_API` annotation on that entry should fix the link** — **FALSE**

False because the undefined set was never just that entry. It also held `IRInst::getFirstChild`, `getLastChild`, `getOperands`, `getDecorations`, `IRInstListBase::begin/end` + its iterator `operator++`, `ComponentType::getTargetProgram` — every one defined **out-of-line in a `.cpp`** (getFirstChild is only *declared* in the header; defined at slang-ir.cpp:8863). The test TU can't emit them, so each *definition* needs exporting. One annotation leaves the whole IR-traversal surface undefined.

**The shape:** this is the inverse of the more famous trap (wrong premise supporting a right conclusion). Here every premise was individually verified and the conclusion still failed, because I **verified one element of a set and generalized to the set**. Hidden-visibility-vs-static was the right diagnosis *for the symbol I looked at*, and simply didn't govern the other seven.

**The rules:**
1. When a diagnosis explains one member of a failing set, ask *how many members are in the set, and did I check any other one?* Fixing the instance you examined is not fixing the class. For linker errors specifically: **read the whole undefined-symbol list before proposing a fix** — the first symbol is rarely representative.
2. Declared-in-header ≠ defined-in-header. Before assuming a member function is inline-emittable by the consumer, find the **definition**, not the declaration.
3. **The real save was procedural, not analytical.** I attached an explicit gate — "do not put this to the maintainer until someone confirms it actually links" — and the gate killed it. Absent that, a suggestion that doesn't work goes to a maintainer under my name. When you can't run the check yourself, ship the *question*, never the *conclusion*; and state plainly which parts you verified and which you inferred, so the holder of the tree knows exactly what to test.

**Meta:** this landed in a chain where we had already logged four errors of the form "verified a proxy instead of the thing." This is the fifth and it is *not* that error — the checks were real and load-bearing. Rigor on individual facts does not confer rigor on the leap between them.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785776642421-correct-premises-wrong-conclusion-verifying-one-me.md`_
