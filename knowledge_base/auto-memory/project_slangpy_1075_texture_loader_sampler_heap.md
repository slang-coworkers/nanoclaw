---
name: slangpy-1075-texture-loader-sampler-heap
description: "slangpy#1075 texture-loading sampler-heap fix — approver ABSTAIN_POLICY across 3 heads; human approved but predates CodeRabbit off-by-one"
metadata: 
  node_type: memory
  type: project
  originSessionId: de384b85-9412-4281-8cdf-5eb2540c72ff
---

**shader-slang/slangpy#1075** — "Fix for texture loading exhausting sampler heap" by **ccummingsNV**. Routed to `slangpy-pr-approver` (this session owns the PR→session map via `report_pr_created`). Canonical thread `gh-issue-shader-slang/slangpy-1075`.

Rapidly-moving PR; approver re-decided at each real head — **ABSTAIN_POLICY:OPEN_GAP at every head so far (5 heads)**:

| Head | Event | Decision |
|------|-------|----------|
| `8b22345` | opened | ABSTAIN_POLICY:OPEN_GAP — Q1 (`device->wait()` vs frontloading) + Q2 (slang-rhi `fprintf(stderr)` vs throw) |
| `d03f063` | "Restore slang-rhi version" | ABSTAIN_POLICY:OPEN_GAP — Q2 resolved (submodule reverted to base); Q1 open; Devin flagged unsynced `create_texture_array` |
| `e65086c` | merge main + author clarification + CodeRabbit | ABSTAIN_POLICY:OPEN_GAP — off-by-one 🟠 Major flagged @373-377 |
| `e396c57` | R4 no-op "Merge branch 'main'" | ABSTAIN_POLICY:OPEN_GAP — footprint byte-identical; both gaps persist unfixed |
| `4415159` | R5 **material diff** — stream-loading feature | **ABSTAIN_POLICY:OPEN_GAP (current)** — see below |

**Net PR footprint at final head:** only `texture_loader.cpp` +2/−1 (two `device->wait()` calls). Merge-main churn (wheels.yml, changelog, version bumps) is base content, not PR footprint → no fresh Devin, no protected-path issue.

**Resolved gaps:** Q2 — slang-rhi change removed/reverted to base sha (verified). Q1 — author (ccummingsNV) clarified the `wait()` throttles the **blit-copy of loaded textures into GPU memory** (CPU-backpressure so it doesn't run too far ahead dispatching copies), NOT frontloading of texture loading itself; code-accurate.

**Why still abstain (not approve):** at head `e65086c` CodeRabbit posted a 🟠 Major off-by-one at `texture_loader.cpp:373-377` — batch wait fires on `i % BATCH_SIZE == 0` so first batch = 33 not 32, plus an empty-encoder submit for N≡1 mod 32. Approver verified: real but low-severity (output correct, heap still bounded, batching `if` is pre-existing — PR only added the wait) → OPEN_GAP, not a verified crash. Sibling `create_texture_array` (line ~430) still unsynchronized (Devin-flagged, pre-existing). Neither BLOCK-worthy; on the CodeRabbit fallback tier with an unresolved finding, uncertainty ⇒ abstain.

**Human join:** tdavidovicNV **APPROVED** at `e65086c` (11:18:47Z), recorded via `record_human_verdict` — but that predates CodeRabbit's finding (11:21:24Z) by ~3 min, so it didn't weigh the off-by-one. Approver records the human verdict as the measured-against outcome but does NOT round its independent shadow call up to match.

**R5 head `4415159` (current, 07-30):** push is a **material diff** (not another no-op merge) — adds a stream-loading feature: new `load_texture(Stream*)` overload + `Stream*` refactor + 2 new GPU tests (`tests/sgl/device/test_texture_loader.cpp`), 112 lines/4 files, none protected. Approver re-harvested CodeRabbit (fresh at head) + re-ran Devin (exit 0). **Both gaps still persist unfixed**, verified against live source: (1) off-by-one now at `texture_loader.cpp:387` (`if (i && (i % BATCH_SIZE == 0))`) — CodeRabbit downgraded 🟠 Major → 🟡 Minor; (2) sibling `create_texture_array` (`:447-462`) still lacks `device->wait()` on per-batch + final submit (vs `create_textures` which waits after both) — Devin flags as 🔴 device-crash @`:430`. Approver held Devin's 🔴 as an OPEN_GAP not a hard BLOCK: code fact verified but crash unreproduced, and the array path's mechanism plausibly differs from the PR's sampler-heap target (one descriptor for `texture_2d_array` vs N in `create_textures`) → fallback-tier + uncertainty ⇒ abstain, never round up. A 3rd CodeRabbit note (🔵 Trivial) asks the new tests to validate texel data via GPU readback, not just metadata — test-strength nit, not a shipping defect.
**Human state at R5:** `reviewDecision=REVIEW_REQUIRED`; tdavidovicNV's earlier approval is now **DISMISSED** by this push. Human review owns it.

**Next-action (human/author):** apply CodeRabbit's off-by-one one-liner `(i + 1) % BATCH_SIZE == 0 && (i + 1) < source_images.size()`; decide whether `create_texture_array` needs the same `device->wait()` (Devin's 🔴). All decisions recorded to ledger, shadow mode → **never posted to GitHub**. If a future synchronize lands, route to approver at the new head; a merge closes the chain.
