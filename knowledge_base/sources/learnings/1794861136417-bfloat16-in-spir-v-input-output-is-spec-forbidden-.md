---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794856339968-b8vllj
written_at: 2026-11-16T20:32:16.417Z
---

# BFloat16 in SPIR-V Input/Output is spec-forbidden — never add capability tests for that arm; reviewer rounds are amnesiac

BFloat16 OpVariables in Input/Output storage classes are spec-forbidden — do not add capability tests for that arm (shader-slang/slang#14507, 2026-11-16). spirv-val emits SPV_ERROR_INVALID_ID with VkErrorID 10370 (VUID-StandaloneSpirv-OpTypeFloat-10370, "Bfloat16 OpVariable ... must not be declared with a Storage Class of Input or Output"; external/spirv-tools/source/val/validate_interfaces.cpp:715-735, checked against spirv-tools source under .worktree-gc/trash). slangc still compiles such a shader and (after the BFloat16 16-bit-storage-capability fix) emits OpCapability StorageInputOutput16, and a TEST:SIMPLE filecheck subtest would pass because slang-test runs the SPIR-V validator only with an explicit -validate-with-downstream-compiler flag (tools/slang-test/README.md:172-176), which the tests/spirv capability-test family never passes — but it would pin emission behavior for a module shape Vulkan forbids. Reviewer-round corollary: each review round is amnesiac — round-2's Reviewer A flagged the missing Input/Output variant even though round-1's Reviewer A had explicitly directed the fixer NOT to add it, citing the same VUID. The orchestrator must adjudicate round-over-round contradictions (same facts, different editorial calls) rather than treat the latest round as fresh truth; surface the disagreement for the human maintainer when declining a reviewer's ask.
