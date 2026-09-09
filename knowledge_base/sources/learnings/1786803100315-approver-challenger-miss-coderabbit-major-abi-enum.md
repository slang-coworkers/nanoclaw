---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786801515391-3iic2t
written_at: 2026-08-15T14:11:40.315Z
---

# [approver/challenger-miss] CodeRabbit "Major" ABI/enum findings can be false positives — verify enum-insertion claims against the actual diff hunk

**Symptom:** On slang-rhi#841 (new ResourceHeap public API, fallback tier), CodeRabbit posted a 🟠 **Major** "potential_issue" claiming `include/slang-rhi.h:90` inserts `StructType` members mid-enum, renumbering later values and breaking ABI for persisted enums — anchored to a specific line, phrased with a path-instruction citation ("include/** enum values must never insert in the middle").

**Root cause:** The finding was WRONG. The actual diff hunk `@@ -85,6 +85,9 @@ enum class StructType` appends `ResourceHeapDesc`/`ResourcePlacementDesc` at the END of the enum, right before the closing `};` — the correct append-only position. CodeRabbit's line anchor (:90) landed on the new members but its *classification* (mid-enum insertion) was fabricated. `NativeHandleType` additions used explicit hex values; new COM vtable methods (`ICommandEncoder::aliasResources`, `IDevice::createResourceHeap/get*MemoryRequirements`) were appended at interface ends — all ABI-safe.

**How to catch it:** A mechanically-verifiable finding (enum ordering, vtable append position, ABI) is the CHEAPEST to confirm and the one you MUST open before trusting the batch. Pull `gh pr diff` (or the file at head+base) and read the actual hunk — do NOT trust the reviewer's prose classification, even at "Major" severity with a path-instruction citation. For enum-ABI claims specifically: confirm whether new members land before the closing brace (append-only = safe) or between existing members (insertion = break).

**Fix / calibration:** A refuted mechanically-checkable Major means the whole batch is NOT individually reliable → do NOT round any of its findings up to a *verified* 🔴 Bug (BLOCK requires a verified 🔴). But the refutation does NOT clear the batch either — the remaining findings on a brand-new cross-backend public API (here: `validateResourcePlacement` omitting a heap-owner==creating-device check → foreign-device backing allocation; Vulkan memory-requirement probe built without init-data usage → size understatement; a real 240-byte OOB test read; single-backend execution coverage) were plausible-real gaps with real blast radius. With CodeRabbit's own REQUEST_CHANGES / Merge-Risk-High verdict + fallback-tier caution, that is ABSTAIN_POLICY:OPEN_GAP, not BLOCK and not WOULD_APPROVE. The false-positive lowers the ceiling to ABSTAIN (no verified 🔴); it does not raise the floor to APPROVE.

Context: shader-slang/slang-rhi has no production github-actions[bot] review (permanent — CodeRabbit is the only bot signal); Devin is best-effort and frequently doesn't run. So slang-rhi PRs are always fallback-tier and the challenger's own source reads carry most of the decision weight.
