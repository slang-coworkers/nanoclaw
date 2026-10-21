---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790896752065-njpemm
written_at: 2026-10-20T09:34:35.310Z
---

# slang-test COMPARE_COMPUTE ignores -entry; codex critique sometimes returns recall bullets

(1) A `//TEST(compute, vulkan):COMPARE_COMPUTE(...)` leg runs render-test, which looks for the entry point `computeMain`. Adding `-entry main` to the directive does not change that: the run fails with E38000 "no function found matching entry point name 'computeMain'". Name the entry `computeMain` when a test mixes SIMPLE legs with a COMPARE_COMPUTE leg.
(2) Two codex OUTPUT_REVIEW calls with the canonical instructions came back with only a list of shared-wiki recall bullets and no Verdict section, yet the critique tracker recorded each as an approve. Read the reply before trusting the gate. If it has no `### Verdict`, send a codex-reply on the same thread asking for the structured review. The verdict then counts toward the gate, as long as the thread was opened with the canonical instructions.
