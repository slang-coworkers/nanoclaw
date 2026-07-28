---
name: slangpy-1075-texture-loader-sampler-heap
description: "slangpy#1075 texture-loading sampler-heap fix — approver ABSTAIN_POLICY across 3 heads; human approved but predates CodeRabbit off-by-one"
metadata: 
  node_type: memory
  type: project
  originSessionId: de384b85-9412-4281-8cdf-5eb2540c72ff
---

**shader-slang/slangpy#1075** — "Fix for texture loading exhausting sampler heap" by **ccummingsNV**. Routed to `slangpy-pr-approver` (this session owns the PR→session map via `report_pr_created`). Canonical thread `gh-issue-shader-slang/slangpy-1075`.

Rapidly-moving PR; approver re-decided at each real head:

| Head | Event | Decision |
|------|-------|----------|
| `8b22345` | opened | ABSTAIN_POLICY:OPEN_GAP — Q1 (`device->wait()` vs frontloading) + Q2 (slang-rhi `fprintf(stderr)` vs throw) |
| `d03f063` | "Restore slang-rhi version" | ABSTAIN_POLICY:OPEN_GAP — Q2 resolved (submodule reverted to base); Q1 open; Devin flagged unsynced `create_texture_array` |
| `e65086c` | merge main + author clarification + CodeRabbit | **ABSTAIN_POLICY:OPEN_GAP (final)** |

**Net PR footprint at final head:** only `texture_loader.cpp` +2/−1 (two `device->wait()` calls). Merge-main churn (wheels.yml, changelog, version bumps) is base content, not PR footprint → no fresh Devin, no protected-path issue.

**Resolved gaps:** Q2 — slang-rhi change removed/reverted to base sha (verified). Q1 — author (ccummingsNV) clarified the `wait()` throttles the **blit-copy of loaded textures into GPU memory** (CPU-backpressure so it doesn't run too far ahead dispatching copies), NOT frontloading of texture loading itself; code-accurate.

**Why still abstain (not approve):** at head `e65086c` CodeRabbit posted a 🟠 Major off-by-one at `texture_loader.cpp:373-377` — batch wait fires on `i % BATCH_SIZE == 0` so first batch = 33 not 32, plus an empty-encoder submit for N≡1 mod 32. Approver verified: real but low-severity (output correct, heap still bounded, batching `if` is pre-existing — PR only added the wait) → OPEN_GAP, not a verified crash. Sibling `create_texture_array` (line ~430) still unsynchronized (Devin-flagged, pre-existing). Neither BLOCK-worthy; on the CodeRabbit fallback tier with an unresolved finding, uncertainty ⇒ abstain.

**Human join:** tdavidovicNV **APPROVED** at `e65086c` (11:18:47Z), recorded via `record_human_verdict` — but that predates CodeRabbit's finding (11:21:24Z) by ~3 min, so it didn't weigh the off-by-one. Approver records the human verdict as the measured-against outcome but does NOT round its independent shadow call up to match.

**Next-action (human/author):** confirm the off-by-one is acceptable or apply CodeRabbit's one-liner `(i + 1) % BATCH_SIZE == 0 && i + 1 < source_images.size()`; decide whether `create_texture_array` needs the same `device->wait()`. All decisions recorded to ledger, shadow mode → **never posted to GitHub**. If a future synchronize lands (e.g. off-by-one fix), route to approver at the new head; a merge closes the chain.
