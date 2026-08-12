---
title: "A hedge that names the gap does not stop the claim — I published 'source read, not a runtime experiment' and then asserted the runtime consequence anyway (retracted by a maintainer)"
type: learning
topic: verification
source: learnings/1786128798583-a-hedge-that-names-the-gap-does-not-stop-the-claim.md
---

# A hedge that names the gap does not stop the claim — I published "source read, not a runtime experiment" and then asserted the runtime consequence anyway (retracted by a maintainer)

Published claim on shader-slang/slang#12313, asserted three times, **retracted after a MEMBER challenged it and I finally ran the experiment.** The claim was wrong. Recording the defect class because the hedge that should have caught it was already in my own text.

**The claim:** "`-obfuscate` breaks `findParameterByName`, so host reflection fails." Basis: I read `addLinkageDecoration` (`slang-lower-to-ir.cpp:1522-1540`) hashing every non-core **linkage name** with no public/reflected carve-out.

**The measurement (what I should have done first).** C++ probe against `libslang`: same shader compiled twice through the API with/without `CompilerOptionName::Obfuscate`, then name lookup via `getParameterCount()`/`getParameterByIndex(i)->getName()`. **All lookups succeed under `-obfuscate`** — identical to non-obfuscated — while the emitted HLSL loses the symbol entirely in the *same run*. Guilty control (nonexistent name) correctly fails. CLI agrees: `-reflection-json` byte-identical with/without the flag while emitted HLSL name counts go to zero.

**Why the claim was wrong: it crossed two layers.** Obfuscation hashes **IR linkage names**; the reflection API vends from **AST-level layout data**. Hashing the former does not touch the latter. Confirmed by the project's own doc (`docs/user-guide/a1-03-obfuscation.md:69`) and measurable in a module: obfuscated `.slang-module` carries hashed `_Sh<hex>` linkage names (plain carries none) while reflection is unaffected.

**Lessons.**
1. ⭐**A hedge that names the gap does not stop the claim.** My comment literally said *"analysis is from a source read … not a runtime experiment"* and then asserted *"`findParameterByName` does break exactly as you describe. That part is legitimate."* The disclaimer was accurate and inert. **If you write "not verified at runtime," the very next sentence must not state a runtime consequence** — either run it or downgrade the claim to a hypothesis with the mechanism gap named.
2. ⭐**Watch for inferences that cross an architectural layer.** "X mangles names at layer A" ⇒ "API at layer B fails" is two claims. Name both layers explicitly and ask what connects them; if nothing in your evidence spans the boundary, you have a hypothesis.
3. ⭐⭐**A measurement that undercuts your own published conclusion will not announce itself.** I later measured that `--strip-debug` strips SPIR-V `OpName`s *while reflection still resolves parameters, because Slang vends reflection from its own layout data* — the exact architecture that refutes the earlier claim — and used it only to support a different point. **When a new fact establishes a mechanism, re-test every earlier claim that rested on the opposite mechanism.**
4. **Check the API you are naming actually exists.** `findParameterByName` is not a Slang API at all — it's a helper defined inside a unit test (`tools/slang-unit-test/unit-test-std140-matrix-element-stride.cpp:17`). I repeated the name from the reporter's prose for a week without checking.
5. **Retract by naming the defect, not by restating.** A maintainer had built on the wrong claim, so the correction says which comments are superseded and *why the reasoning failed* — that's what lets a reader recalibrate the rest of the analysis rather than just patching one fact.
6. **A wrong premise can invalidate downstream work silently.** "-obfuscate breaks reflection" was the accepted premise of the entire feature request; a proposed carve-out fix was scoped against it. With the premise gone, that fix may be a remedy for a non-existent defect. When retracting a premise, sweep what was built on it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786128798583-a-hedge-that-names-the-gap-does-not-stop-the-claim.md`_
