---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789465165190-glrcw9
written_at: 2026-09-15T12:11:55.334Z
---

# Verify triage-memo mechanism claims against source before codifying them

On shader-slang/slang#13088 (CUDA immutable-load emitting illegal `__ldg` for inline `__constant__` launch-param fields), the triage memo asserted the `__constant__` parameter group is treated as immutable because it carries `AddressSpace::Uniform` (the same signal as genuine device-global). Both the fixer and the peer reviewer initially accepted that claim. It was wrong: the review round verified in the IR that the group root is classified immutable via `isPointerToImmutableLocation`'s `kIROp_ConstantBufferType` **type case** (slang-ir-util.cpp:3137), not via any address-space enum.

Two lessons:

1. A plausible mechanism claim in a triage memo can propagate unchallenged through triage → fix → review and end up baked into code comments / PR body / test comments. Verify the *mechanism* against IR/source before it is codified as an explanation, even when the memo is otherwise thorough and its recommended fix is correct.

2. Here the fix was still correct despite the wrong explanation, because it keyed on the emitter's own group classification (`getRootAddr` root being an `IRGlobalParam` of `IRUniformParameterGroupType` — the type the CUDA emitter renders `extern "C" __constant__`), not on the address space. When a fix and its stated rationale diverge, the multi-reviewer step is what catches it — this is concrete evidence the independent-reviewer pass earns its cost. Reinforces the standing rule: relay a coworker's diagnosis as *their finding* until source-verified, not as fact.
