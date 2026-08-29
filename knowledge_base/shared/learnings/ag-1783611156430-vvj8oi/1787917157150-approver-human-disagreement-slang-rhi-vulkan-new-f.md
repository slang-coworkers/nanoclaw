---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787908467991-0m1zz1
written_at: 2026-08-28T11:39:17.150Z
---

# [approver/human-disagreement] slang-rhi Vulkan new-feature PR: refuted-bot-Major + unproven accounting-omission + zero-exec-coverage merged unchanged with admin approve — recalibrate that combo below OPEN_GAP

**Context:** slang-rhi#848 "vk: support explicit push constant buffers" @1cc7076 (skallweitNV, MEMBER). I decided ABSTAIN_POLICY/OPEN_GAP. Outcome: MERGED at my EXACT decided head, ZERO interval commits, with an INDEPENDENT admin approval (ccummingsNV ≠ author) at that head. So my abstain was an over-conservative DISAGREEMENT (not a false-safe — abstain never auto-approves).

**What I held it on (all shipped unchanged):**
1. A CodeRabbit 🟠 Major "potential_issue" I traced to a LIKELY FALSE POSITIVE (pre-existing non-raygen→push-constant routing, PR only refactors + adds bounds asserts).
2. A layout-accounting arm asymmetry (`vk-shader-object-layout.cpp:478-481`: new `PushConstant` sub-object arm omits `m_childPushConstantRangeCount += getTotalPushConstantRangeCount()` its sibling `ConstantBuffer` arm has) I could NOT clear from a source read — a plausible undersizing gap for NESTED push-constants (an untriggered path).
3. Structural zero-execution-coverage (the sole new `GPU_TEST_CASE(...,Vulkan)` never runs on slang-rhi's build-only CI).

**Calibration (transferable, the class not the instance):** for a SELF-CONTAINED NEW-FEATURE Vulkan binding/layout path by a TRUSTED MEMBER where (a) the loud bot finding is one I've actually refuted, (b) the residual gap is an UNPROVEN accounting-omission on an UNTRIGGERED sub-path (not a demonstrated wrong result), and (c) the only coverage hole is the standing slang-rhi structural one (no GPU executor) — maintainers treat that as mergeable. The empirical severity of an *unproven* undersizing-omission on an untriggered nested path is closer to ADVISORY than OPEN_GAP. Reserve OPEN_GAP for a gap with a REACHABLE trigger on the SUPPORTED path, or a demonstrable wrong result, or blast radius that undermines the PR's stated purpose — not for "I can't prove this omitted accumulator is harmless."

**What NOT to retract:** the term-by-term sibling-arm diff of a touched accounting switch is still the correct challenger move — it's the right PLACE to look. This recalibrates the WEIGHT an unresolved-but-unproven finding there carries, not whether to look. And note the standing slang-rhi zero-exec-coverage fact is a CONSTANT across these PRs, so it cannot by itself distinguish a hold-worthy PR from a mergeable one; it only compounds a gap that already has an independent reachable trigger.

**Counter-guard (don't over-correct):** this is ONE datapoint and the change was low-risk-shaped (new isolated feature, trusted author, admin sign-off). It does NOT license rounding up a gap with a real reachable trigger, a demonstrated wrong result, or an untrusted/fork author. Abstain remains correct when the residual is genuinely reachable on the supported path.
