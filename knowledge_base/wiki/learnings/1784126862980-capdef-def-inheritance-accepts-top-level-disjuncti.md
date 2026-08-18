---
title: "capdef def inheritance accepts top-level | disjunction but NOT parenthesized (b|c) inside a conjunction"
type: learning
topic: misc
source: learnings/1784126862980-capdef-def-inheritance-accepts-top-level-disjuncti.md
---

# capdef def inheritance accepts top-level | disjunction but NOT parenthesized (b|c) inside a conjunction

**Context:** slang#12097 — modeling the SER extension's spec dependency ("SPIR-V 1.4 + (SPV_EXT_physical_storage_buffer | SPV_KHR_physical_storage_buffer | SPIR-V 1.5)") in `source/slang/slang-capabilities.capdef`.

**Verified with the generator (`slang-capability-generator <capdef> --target-directory <dir>`):**
- A `def X : ...` inheritance clause is parsed by `parseExpr()`, which **accepts a top-level `|` disjunction**: `def X : a + b + c | a + b + d | a + e;` parses cleanly (GEN exit 0). This is the DNF (disjunction-of-conjunctions) form the capdef header documents (`raytracing = glsl + _GL_EXT_ray_tracing | spirv_1_4 + SPV_KHR_ray_tracing | hlsl + _sm_6_4`).
- It does **NOT** accept a *parenthesized* disjunction inside a conjunction: `def X : a + (b | c);` → `error 20001: unexpected (, expected identifier`. `parseConjunction()` only joins bare identifiers with `+`; there is no grouping-paren support.
- So to express "a AND (b OR c)" you must **hand-expand** to `a + b | a + c` (distribute), not write the parenthesized form.

**Correction to a prior belief:** `|` is NOT "only allowed in aliases" — both `def` and `alias` inheritance go through `parseExpr` and accept top-level `|`. (Aliases just happen to be where most existing disjunctions live.)

**Caveat not fully explored:** whether making an *atom-introducing* `def` disjunctive changes how downstream `def Y : X` inheritors resolve is untested — if you need a disjunctive requirement that other atoms inherit, verify the inheritance still behaves. For slang#12097 I chose a single-atom dependency (`+ SPV_KHR_physical_storage_buffer`) over the expanded disjunction for simplicity and to keep the SER atom's shape unchanged.

**Process lesson:** when claiming a syntax limitation to a maintainer, test the EXACT form you're claiming fails — I over-generalized "parenthesized disjunction fails" into "disjunction only works in aliases," which codex OUTPUT_REVIEW caught by reading the generator's `parseDefs`/`parseExpr`. Test the specific spelling, don't extrapolate.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784126862980-capdef-def-inheritance-accepts-top-level-disjuncti.md`_
