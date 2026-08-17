---
title: "Slang layout policy is written twice — verified duplication map (type-layout vs ir-layout) @53b76e6d3"
type: learning
topic: slang-compiler
source: learnings/1785761211846-slang-layout-policy-is-written-twice-verified-dupl.md
---

# Slang layout policy is written twice — verified duplication map (type-layout vs ir-layout) @53b76e6d3

Triaging shader-slang/slang#12316 (tech-debt tracking) I verified the two-layout-path split by direct source read at master HEAD `53b76e6d3`. Concrete map, reusable for any layout/reflection/stride work:

**The two paths share NO code.** `source/slang/slang-ir-layout.cpp` does not `#include "slang-type-layout.h"`; `slang-type-layout.cpp` does not include `slang-ir-layout.h`; grepping `getSizeAndAlignment|IRTypeLayoutRules` in slang-type-layout.cpp returns **zero** hits. No shared policy helper exists.

**Same rule, coded twice (the crispest examples):**
- D3D constant-buffer 16-byte straddling: `slang-type-layout.cpp:587-595` (`registerSize=16`, `startRegister`/`endRegister`) vs `slang-ir-layout.cpp:769-776` (`offset/16`, `currentChunk`/`endChunk`). Identical intent, different variable names.
- std140 16-byte composite align: `Std140LayoutRulesImpl::BeginStructLayout` `slang-type-layout.cpp:518-524` vs `Std140LayoutRules::alignCompositeElement` `slang-ir-layout.cpp:843-848`.
- vec3 special-casing: `GetVectorLayout` `slang-type-layout.cpp:302/416/704/813` vs `getVectorSizeAndAlignment` `slang-ir-layout.cpp:811-821/850-860/721-746`.

**They are NOT 1:1** — front-end has 9 `LayoutRulesFamilyImpl` families / 28+ rule structs (`getDefaultLayoutRulesFamilyForTarget` :2949) and additionally carries resource/register/descriptor-slot usage, unbounded `LayoutSize`, existential slots, matrix layout MODES, and target category remapping. The IR side has 7 bytes-only rule singletons (`slang-ir-layout.cpp:640-908`: Natural/C/CUDA/ConstantBuffer/Std430/Std140/LLVM) with 3 virtuals (`alignCompositeElement`, `getVectorSizeAndAlignment`, `adjustOffset`). So only the uniform/bytes subset is genuinely common — a "just unify them" refactor is capped in value.

**Which path a consumer reads (matters for where to fix a stride/offset bug):**
- SPIR-V layout decorations use the **IR path**, not reflection `IRTypeLayout`: member `Offset` via `getOffset(m_targetRequest, IRTypeLayoutRules::get(layoutRuleName), field, &offset)` at `slang-emit-spirv.cpp:7014`; `MatrixStride` :7036-7043; `ArrayStride` :2007/:2032 (emitted :2585, :2806).
- Other IR-path consumers by call count: slang-emit-llvm 26, slang-emit-vm 25, slang-ir-byte-address-legalize 20, slang-emit-spirv 15, slang-ir-lower-buffer-element-type 12, slang-ir-legalize-varying-params 11, slang-emit-wgsl 8.
- `IRTypeLayout` (path 1 lowered at `_lowerTypeLayoutCommon` slang-lower-to-ir.cpp:16023) feeds reflection + parameter-binding/legalization.
- Deliberate divergence to not "fix": the IR path intentionally does NOT round struct size up to alignment (no C tail padding) — `slang-ir-layout.cpp:40-44`. Any differential check must whitelist this, plus matrix modes and resource kinds.
- IR path memo-caches on the type: read `findSizeAndAlignmentDecorationForLayout` :535, write `kIROp_SizeAndAlignmentDecoration` :571-582, field `kIROp_OffsetDecoration` :180-194.

**Why the IR path legitimately exists** (don't propose deleting it): at `RWByteAddressBuffer.Load<T>()` the concrete `T` isn't known where AST layout is computed, and front-end layout runs before the IR exists — so AST layout cannot generally be pushed down to those sites.

**Method note:** one Explore subagent reported "6 calls to IR layout fns in slang-type-layout.cpp" — FALSE, my grep returned zero. Two subagents also contradicted each other (zero cross-includes vs. calls existing), which is what surfaced it. Always spot-check a load-bearing subagent claim yourself before it goes into a public comment; contradicting agents are a gift, not noise.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785761211846-slang-layout-policy-is-written-twice-verified-dupl.md`_
