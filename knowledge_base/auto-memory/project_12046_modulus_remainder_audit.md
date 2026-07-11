---
name: project_12046_modulus_remainder_audit
description: "#12046 modulus/remainder emission audit — maintainer scrutiny umbrella, PARKED at triaged"
metadata: 
  node_type: memory
  type: project
  originSessionId: b3dee100-6647-4f34-a90c-7f197c687c31
---

shader-slang/slang#12046 — "Scrutinize the modulus/remainder operators and functions and the emitted instructions on different targets." Opened by **skiminki-nv** (maintainer, "Dev Opened"; Type=Performance; labels Metal/GLSL). A maintainer-opened **scrutiny/audit umbrella**, not a single handed-off bug.

**Semantic ground truth (triager-confirmed via source + DeepWiki):** Slang `%`(float)/`fmod()` = truncation remainder, sign follows DIVIDEND = SPIR-V `OpFRem` (both lower to IR `kIROp_FRem`; no `kIROp_FMod` exists). GLSL `mod()` = floor modulus `x-y*floor(x/y)`, sign follows DIVISOR = `OpFMod`. Differ for negatives: `-1.5 % 2.0`=-1.5 (rem) vs `mod(-1.5,2.0)`=0.5.

**Audit surface (file:line):**
- **F1 [REAL CORRECTNESS BUG]** slang-emit-glsl.cpp:2601-2626 — GLSL text emitter maps raw `FRem` → GLSL `mod()` (floor modulus). WRONG for negative operands; TODO in code already acknowledges. Reachable via `float%float` → GLSL text + `-emit-spirv-via-glsl`. SPIR-V *direct* target UNAFFECTED (OpFRem at :859). Stdlib `fmod()` GLSL case (hlsl.meta.slang:11288) is CORRECT (uses sign-flip workaround); bug is only the raw `%`/FRem path that bypasses stdlib. Fix = mirror stdlib sign-flip in emitter. **Static analysis, NOT runtime-reproduced.**
- **F2 [OPTIMALITY, design-gated]** glsl.meta.slang:494-533 — stdlib `mod()` on SPIR-V falls to `default: x-y*floor(x/y)` (4 instrs) instead of single `OpFMod`. This is skiminki's "shouldn't SPIR-V emit OpFMod?" lead — YES, but codegen-quality/precision call → maintainer decision.
- **F3 [CLEANUP, redundant]** hlsl.meta.slang:11292 — Metal stdlib `fmod()` uses needless sign-flip; Metal `fmod` is ALREADY trunc-remainder (triager hand-checked 4 quadrants, bit-identical). Simplify to `__intrinsic_asm "fmod"`. skiminki's "shouldn't Metal emit plain fmod?" lead — YES. (Misleading comment at :11248 is the cause.)
- **F4 [SCRUTINY]** slang-emit-glsl.cpp:2627 — GLSL int `%`/IRem via default c-like `%`; negative-operand behavior underspecified in older GLSL. Flag, don't fix blind.
- **F5 [DOCS, trivial]** docs/language-reference/expressions-operators.md:65-68 — add closed form `a%b == a-trunc(a/b)*b` as alternative definition. One-liner.

**Routing verdict: PARKED at triaged, HOLD fixer routing for skiminki/maintainer.** Per established pattern for maintainer self-filed scrutiny/design issues (#12042/#12040/#12038/#12035 all parked). NO auto-dispatch. Approach A (F1+F5) is the one unambiguous non-design slice, fixer-ready **on an explicit go**; F2/F4 are maintainer calls. Triager owns posting the audit as a GitHub comment (hedged: static, not reproduced) + offering slice A back to skiminki.

**Dup history:** #1059 (CLOSED via #3470, established current semantics), #5026 (CLOSED), #10071 (OPEN, autodiff fmod grad — distinct). No open dup of this umbrella. Related to [[user_interests]] N/A. See sibling parked maintainer scrutiny: [[project_12035_overload_diag_reasons]], [[project_12023_compileperf_sweep_abstain_policy]].
