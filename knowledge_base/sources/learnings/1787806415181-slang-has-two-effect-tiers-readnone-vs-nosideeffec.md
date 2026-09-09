---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787805655972-gyqlgs
written_at: 2026-08-27T04:53:35.181Z
---

# Slang has two effect tiers (ReadNone vs NoSideEffect) — only ReadNone gates call CSE

From triaging #12785 (read-only-resource-load call CSE). The Slang IR has TWO distinct function-effect decorations, inferred separately by `propagateFuncProperties`:

- **`IRReadNoneDecoration`** = no reads AND no writes to memory ⟹ result depends only on args ⟹ safe to CSE **and** move/speculate. Read by `isPureFunctionalCall` (slang-ir-util.cpp:1633) — the ONLY gate for call CSE (via `isMovableInst` kIROp_Call arm, slang-ir.cpp:10186) and for hoisting.
- **`IRNoSideEffectDecoration`** = no observable writes, but MAY read memory ⟹ safe to DCE (delete if unused) but NOT to move. Read by `isNoSideEffectCallee`/`isSideEffectFreeFunctionalCall` (slang-ir-util.cpp:3289/1643), consumed only by DCE (slang-ir-dce.cpp:519). ReadNone ⟹ NoSideEffect.

Key non-obvious facts:
1. A function whose body contains a read-only `StructuredBuffer`/SRV load is DELIBERATELY denied `ReadNone` by `isResourceLoad()` in `ReadNoneFuncPropertyPropagationContext::propagate` (slang-ir-propagate-func-properties.cpp:110) — this is PR #3441 (commit 8dd04c873), which added `tests/bugs/gh-3429.slang` to pin that resource loads stay inside their original if/else branches (moving them = OOB read). PR #2680 (a3ba22b51) had earlier marked read-only resource ops `[__readNone]` at the op level.
2. BUT that same wrapper DOES earn `[__noSideEffect]` — the NoSideEffect propagate context (:291-350) has NO `isResourceLoad` clause, and `kIROp_StructuredBufferLoad` is side-effect-free in `mightHaveSideEffects` (slang-ir.cpp:9549).
3. **Consequence:** call CSE checks ONLY ReadNone, so a resource-load wrapper is never commoned even when the first call DOMINATES the second — while a genuinely pure wrapper is. There is NO intermediate "repeatable read-only access / CSE-eligible-but-not-movable" tier; that gap is exactly what #12785 asks to fill.
4. Precedent for the fix: `isMovableInst`'s kIROp_Load arm (slang-ir.cpp:10200) already treats `UniformConstant` (ConstantBuffer/ParameterBlock) resource loads as movable — a narrow read-only-load carve-out. #12111 extended a similar coalesce but only for SPIR-V UniformConstant loads.

Lesson: when asked whether a call can be "deduplicated/commoned", do NOT conflate it with "movable/speculatable" — Slang keeps these separate at the decoration level (ReadNone vs NoSideEffect) but the CSE path currently only reads the stronger one. Any fix that makes resource loads *movable* to enable CSE will regress gh-3429; the correct lever is a CSE-only, dominated-only dedup path.
