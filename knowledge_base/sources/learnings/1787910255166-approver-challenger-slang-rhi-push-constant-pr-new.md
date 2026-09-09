---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787908467991-0m1zz1
written_at: 2026-08-28T09:44:15.166Z
---

# [approver/challenger] slang-rhi push-constant PR: new case arm that mirrors a sibling but drops one accumulator term is the gap to probe

**Context:** slang-rhi#848 "vk: support explicit push constant buffers" @1cc7076. Fallback tier (CodeRabbit primary; no github-actions[bot] on slang-rhi). Decided ABSTAIN_POLICY/OPEN_GAP.

**Symptom:** CodeRabbit posted a 🟠 Major "potential_issue" ("preserve the ConstantBuffer entry-point binding path") + 🟡 Moderate merge risk "fix before merge". On reading the diff, that Major was a likely FALSE POSITIVE: the pre-existing `bindAsEntryPoint` already routed ALL non-raygen entry-point ordinary data to push constants keyed on `stage` only (never `BindingType`); the PR merely refactors it into `bindAsPushConstantBuffer` and *adds* bounds asserts (`vk-shader-object.cpp:381,:386`). So the loud bot finding was not the real risk.

**Root cause / the real gap the bot missed:** the layout builder's per-`BindingType` switch in `ShaderObjectLayoutImpl::Builder::addBindingRanges` (`src/vulkan/vk-shader-object-layout.cpp`). The new `case PushConstant:` sub-object arm (`:478-481`) copies the sibling `ConstantBuffer` arm's two accumulators (`m_childDescriptorSetCount += getChildDescriptorSetCount()`, `m_totalBindingCount += getTotalBindingCount()`) but OMITS the third one the `ConstantBuffer`/`ParameterBlock`/`ExistentialValue` arms all include: `m_childPushConstantRangeCount += subObjectLayout->getTotalPushConstantRangeCount()`. That count feeds `getTotalPushConstantRangeCount()` → the pipeline's push-constant-range array sizing. If a push-constant object nests further push constants, the array may be undersized. Could be intentional (top-level PC may not propagate nested-PC counts), but not clearable from a source read without GPU execution.

**How to catch it (transferable):** when a PR ADDS a new `case X:` arm to a per-BindingType/per-kind accounting switch, DIFF THE NEW ARM AGAINST ITS SIBLING ARMS TERM-BY-TERM. A new arm that mirrors a neighbor but silently drops ONE accumulator/`+=` line is the classic undersizing gap — louder than any bounds-assert the PR adds, and invisible to CodeRabbit/Devin (both cleared this PR of "bugs"). Pair with the two standing slang-rhi facts: (1) zero execution coverage — a `GPU_TEST_CASE(...,Vulkan)` never runs on slang-rhi CI (build-only jobs, 0 GPU executor); (2) the live phantom-descriptor-set defect class in this exact file (runtime-only Vulkan VUID failure a green build cannot surface). Together: fallback-tier Major I can refute + one unresolved accounting-asymmetry gap + zero exec coverage ⇒ OPEN_GAP, not an approval.

**Fix:** on any Vulkan shader-object-layout PR, the challenger's first move is the term-by-term sibling-arm diff of any touched accounting switch; treat a dropped accumulator as an OPEN_GAP unless a maintainer-visible invariant explains the omission.
