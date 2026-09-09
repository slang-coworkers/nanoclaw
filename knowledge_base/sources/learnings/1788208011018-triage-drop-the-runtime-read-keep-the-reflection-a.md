---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787839870753-hpdgfi
written_at: 2026-08-31T20:26:51.018Z
---

# Triage: "drop the runtime read, keep the reflection assertion" can silently erase lowering/layout coverage

**Context:** shader-slang/slang#12797 — two descriptor-handle tests read an *unbound* bindless handle and masked the garbage with `* gOutput` (zero-init). Author reported UB → SIGSEGV on lavapipe. My triage recommended **Approach A: drop the unbound-handle read, keep the `bindlessSpaceIndex` REFLECTION assertion** (the tests came from PR #9870, which is "about reflection"). The fixer shipped it; the maintainer (jvepsalainen-nv, author of #9870) requested changes.

**Why A was wrong:** dropping the read didn't just remove the UB — it removed the *live* bindless heap. A `DescriptorHandle<T>` that is declared-but-never-dereferenced emits no `GetDynamicResourceHeap`, so `lowerDynamicResourceHeap` early-returns and DCE strips `__slang_resource_heap` entirely (slang-ir-lower-dynamic-resource-heap.cpp:48-60). The tests existed to guard a **lowered descriptor-set placement** invariant: the heap lands in set 2 normally, set 3 when an unused ParameterBlock reserves a space first (frontend pre-DCE reservation, slang-parameter-binding.cpp:4818-4834). The REFLECTION `bindlessSpaceIndex` check only validates the *frontend prediction* — NOT that lowering actually places the heap there, nor the RHI layout. So "keep reflection" kept the weak half and dropped the half that mattered.

**The rule (reusable):** before recommending "drop a runtime read + keep the reflection/static check" for a test that looks like it's only hiding a value (multiply-by-zero idiom, etc.), ask: **is the runtime path the ONLY thing exercising a lowering/codegen/layout invariant that the reflection/reflection-JSON check cannot see?** If yes, dropping the read guts the test. Reflection = frontend prediction; it does not prove lowering honored it.

**The correct fix (Approach B, maintainer-directed, was already in my solution space):** keep the read but make it *legal* — bind a real `RWStructuredBuffer<float>.Handle` via `TEST_INPUT` and read it (buffer/storage-buffer descriptor writes work on lavapipe; only IMAGE writes hit the suspected Mesa `VK_EXT_mutable_descriptor_type` bug). Keeps the heap live AND the read valid. Even better: keep the unused ParameterBlock(s) declared-but-unused (drives the set-shift, no image write) + add a SEPARATE live buffer handle for heap liveness, and add a static `//CHECK: OpDecorate %__slang_resource_heap{{.*}}DescriptorSet N` (+REPRO→N+1) to guard the lowered placement the reflection check can't (precedent: parameter-block-bindless-handles.slang:35).

**Meta-lesson on triage recommendations:** my *solution space* was right (B was listed as an alternative), but the *recommendation* picked the fastest-looking fix without auditing what coverage it silently dropped. A triage "recommended path" should include one line on "what coverage does this fix REMOVE, and is that coverage load-bearing?"
