---
title: "slang analyzeMakeStruct positional OOB is LATENT — MakeStruct producers preserve operand==field parity"
type: learning
topic: slang-compiler
source: learnings/1784171101845-slang-analyzemakestruct-positional-oob-is-latent-m.md
---

# slang analyzeMakeStruct positional OOB is LATENT — MakeStruct producers preserve operand==field parity

**Context:** Triaging shader-slang/slang#12132 — `analyzeMakeStruct` in the type-flow specialization pass (`source/slang/slang-ir-typeflow-specialize.cpp`, ~L2260-2283) reads `makeStruct->getOperand(operandIndex)` in a loop bounded by `structType->getFields()`, never checked against `getOperandCount()`. `IRInst::getOperand` (`slang-ir.h:711`) asserts `index < getOperandCount()` → debug abort, release OOB read.

**The non-obvious finding (verify before recommending assert-vs-tolerate):** The bug is **latent** at HEAD — I could not find any producer that delivers an under-supplied `IRMakeStruct` (fewer operands than the struct type has fields) into this pass. Every legitimate under-supply path preserves operand==field **parity**:
- DCE `trimOptimizableType`/`trimMakeStructOperands` (`slang-ir-dce.cpp:404-433, 472-483`) removes the struct field (`field->removeFromParent()`) AND trims the matching MakeStruct operand in lockstep — both decrease together.
- Varying-params return-struct legalization (`slang-ir-legalize-varying-params.cpp:3989, 4002`) builds a FRESH struct with exactly one field and passes exactly one operand (`emitMakeStruct(dstType, 1, &srcVal)`). A naive grep flags this as "1 operand regardless of fields" but the dstType is 1-field by construction — false alarm.
- Autodiff `translateMakeStruct` (`slang-ir-autodiff-fwd.cpp:889+`) builds a fresh differential struct and ALREADY guards the *identical* positional pattern with `SLANG_RELEASE_ASSERT(ii < origMakeStruct->getOperandCount())` at L907.

**Takeaway / recommendation:** The autodiff site at L907 is direct precedent that the codebase treats "MakeStruct operand count ≥ field count" as an invariant worth a release-assert. So the principled fix for #12132 is **assert the invariant at the consumption site** (`SLANG_RELEASE_ASSERT(operandCount == fieldCount)`), NOT bound the loop with `min(fieldCount, operandCount)` — the min-bound tolerate approach silently masks a producer bug (the exact "silent impossible-shape handling" red flag in slang/CLAUDE.md's Self-Review section) and is only justified if a valid short-list producer is demonstrated (none was). This matches slang's "fail loudly on out-of-contract input" rule.

**Method note:** DeepWiki correctly surfaced DCE `trimMakeStructOperands` and autodiff `translateMakeStruct` as under-supply paths, but did NOT establish they preserve parity — that required reading the actual code (the field-removal and operand-trim happening together). A subagent flagged the varying-params site as "potentially unsafe" from operand count alone; reading the surrounding `createStructField` refuted it. Load-bearing OOB/robustness claims must be traced to producers in source, not inferred from a single call-site's operand count.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784171101845-slang-analyzemakestruct-positional-oob-is-latent-m.md`_
