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
| `4415159` | R5 **material diff** — stream-loading feature | ABSTAIN_POLICY:OPEN_GAP — see below |
| `4cb81af` | R6 no-op merge (pulled unrelated main files; `texture_loader.cpp` blob byte-identical to R5) | ABSTAIN_POLICY:OPEN_GAP — both gaps persist verbatim |
| `52a6c5e` | R7 **material** — `texture_loader.cpp` blob now `66fd317d…` off the `bbdada72…` baseline | ABSTAIN_POLICY:OPEN_GAP — Gap 1 RESOLVED; Gap 2 firmed up; new Gap B |
| `b91339d` | R8 — added Gap B test + Gap 2 `device->wait()` | (superseded mid-decision) — Gap B test `texture_loader_batched_uploads` **FAILED deterministically on Metal** (macOS Release+Debug, 32 texel `memcmp` mismatches e.g. `-93==0`); Linux/Windows passed. Real PR-authored failure, NOT the R6 profiler flake |
| `d001b2b` | R9 test-only (+2/−4 test file; `texture_loader.cpp` == `b91339d`) "Make batched upload regression portable" | **ABSTAIN_POLICY:OPEN_GAP (current)** — ⚠️ "portability fix" = **weakened the test** (see below) |

**R6 CI-red @ `4cb81af` (07-31) = INFRA/FLAKE, verdict unchanged (no new ledger row — a `ci_failed` on an already-decided head is not a new revision).** check-suite 83019898453: exactly 1/12 matrix cells failed — `build (linux, x86_64, gcc, Release)` Unit Tests (C++) step; same-platform Debug + clang Release/Debug all passed on identical source. Failing case = `frame statistics align repeated and intermittent zones` @ `test_profiler.cpp:228` — a profiler *timing* test (4 assertions are timing/call-count mismatches `1==2`/`0==2`, classic nondeterminism). **`test_profiler.cpp` is NOT in PR footprint** (PR touches only the 4 texture-loading files; rode in via the merge commit). PR's own stream tests = the 3 "skipped" (no GPU on runner); none of PR's code failed. Under `v0-shadow-relaxed`, `require_ci_green:false` so CI never mechanically gates. reviewer/fixer own the CI loop.

**Net PR footprint at final head:** only `texture_loader.cpp` +2/−1 (two `device->wait()` calls). Merge-main churn (wheels.yml, changelog, version bumps) is base content, not PR footprint → no fresh Devin, no protected-path issue.

**Resolved gaps:** Q2 — slang-rhi change removed/reverted to base sha (verified). Q1 — author (ccummingsNV) clarified the `wait()` throttles the **blit-copy of loaded textures into GPU memory** (CPU-backpressure so it doesn't run too far ahead dispatching copies), NOT frontloading of texture loading itself; code-accurate.

**Why still abstain (not approve):** at head `e65086c` CodeRabbit posted a 🟠 Major off-by-one at `texture_loader.cpp:373-377` — batch wait fires on `i % BATCH_SIZE == 0` so first batch = 33 not 32, plus an empty-encoder submit for N≡1 mod 32. Approver verified: real but low-severity (output correct, heap still bounded, batching `if` is pre-existing — PR only added the wait) → OPEN_GAP, not a verified crash. Sibling `create_texture_array` (line ~430) still unsynchronized (Devin-flagged, pre-existing). Neither BLOCK-worthy; on the CodeRabbit fallback tier with an unresolved finding, uncertainty ⇒ abstain.

**Human join:** tdavidovicNV **APPROVED** at `e65086c` (11:18:47Z), recorded via `record_human_verdict` — but that predates CodeRabbit's finding (11:21:24Z) by ~3 min, so it didn't weigh the off-by-one. Approver records the human verdict as the measured-against outcome but does NOT round its independent shadow call up to match.

**R5 head `4415159` (current, 07-30):** push is a **material diff** (not another no-op merge) — adds a stream-loading feature: new `load_texture(Stream*)` overload + `Stream*` refactor + 2 new GPU tests (`tests/sgl/device/test_texture_loader.cpp`), 112 lines/4 files, none protected. Approver re-harvested CodeRabbit (fresh at head) + re-ran Devin (exit 0). **Both gaps still persist unfixed**, verified against live source: (1) off-by-one now at `texture_loader.cpp:387` (`if (i && (i % BATCH_SIZE == 0))`) — CodeRabbit downgraded 🟠 Major → 🟡 Minor; (2) sibling `create_texture_array` (`:447-462`) still lacks `device->wait()` on per-batch + final submit (vs `create_textures` which waits after both) — Devin flags as 🔴 device-crash @`:430`. Approver held Devin's 🔴 as an OPEN_GAP not a hard BLOCK: code fact verified but crash unreproduced, and the array path's mechanism plausibly differs from the PR's sampler-heap target (one descriptor for `texture_2d_array` vs N in `create_textures`) → fallback-tier + uncertainty ⇒ abstain, never round up. A 3rd CodeRabbit note (🔵 Trivial) asks the new tests to validate texel data via GPU readback, not just metadata — test-strength nit, not a shipping defect.
**Human state at R5:** `reviewDecision=REVIEW_REQUIRED`; tdavidovicNV's earlier approval is now **DISMISSED** by this push. Human review owns it.

**R7 head `52a6c5e` (current, 07-31) — first real code change since R5; verdict still ABSTAIN:OPEN_GAP but one gap closed.** `texture_loader.cpp` blob now `66fd317d…` (off the `bbdada72…` baseline held across R5/R6/the intermediate no-op). Material ⇒ fresh CodeRabbit (2 actionable, both Major) + fresh Devin (🔴 @`:430`).
- **Gap 1 (off-by-one, `create_textures:387`) — ✅ RESOLVED.** Now reads CodeRabbit's exact fix `(i + 1) % BATCH_SIZE == 0 && (i + 1) < source_images.size()`; waits at `:389`/`:394`; neither reviewer re-flags.
- **Gap 2 (`create_texture_array:447-462`) — PERSISTS + firmed up.** Sibling array path still has the old off-by-one form and NO `device->wait()` (loop `:448` + final `:462`). Author fixed `create_textures` in this push but left the sibling inconsistent. Now a **two-reviewer** finding: CodeRabbit 🟠 Major (`discussion_r3689462544`) + Devin 🔴 — CodeRabbit supplies the mechanism (per-item `generate_mips` + unwaited submits retain sampler resources), which **falsifies the earlier R5 "mechanism differs" hedge**. Still held as OPEN_GAP not hard BLOCK: crash is a load/driver-dependent race, unreproduced, fallback tier.
- **New Gap B — test coverage** (CodeRabbit 🟠 Major `discussion_r3689462549`): added tests load one texture each → never trip the >32-texture batch-wait path; the PR's **core sampler-heap safeguard is untested**. Fix wants a ≥33-bitmap-texture GPU test w/ `generate_mips` validating returned data.

**R8/R9 heads `b91339d`→`d001b2b` (07-31) — ⚠️ TEST-INTEGRITY concern; verdict ABSTAIN:OPEN_GAP.**
- **Gap 1** — resolved (from R7).
- **Gap 2 (`create_texture_array` `device->wait()`)** — now **present and correct** at `:449`/`:463` (author propagated the fix). ✅ code-wise.
- **Gap B (>32-texture batch-wait test)** — test added (`texture_loader_batched_uploads`, 33 textures + `generate_mips`). At `b91339d` it **FAILED deterministically on the Metal backend** (macOS Release AND Debug — 32 failed assertions, real texel `memcmp` mismatches e.g. `-93 == 0`); Linux/Windows passed. **Reproduced, PR-authored failure — NOT the R6 profiler flake.** The `d001b2b` "Make batched upload regression portable" push responded by **removing the generated-mip comparison** — the test now checks only mip 0 (base uploaded data that already matched), i.e. **weakened the regression test to green a real failure on the exact array+mip-gen path Devin flags 🔴 / CodeRabbit flagged Major**, rather than explaining why identical layers produce divergent mips on Metal.
- **Why still OPEN_GAP not BLOCK:** approver can't prove from here whether the Metal cross-layer generated-mip divergence is a `create_texture_array` bug vs a Metal/mip-gen quirk, and CodeRabbit hasn't reviewed `d001b2b`. Not an approve (head-current reviewer 🔴 + a test weakened to hide a real failure).

**Next-action (HUMAN must look):** (a) the **removed mip assertions** in `test_texture_loader.cpp` @ `d001b2b`, (b) the **Metal cross-layer generated-mip divergence** the test originally caught, (c) Devin's standing 🔴 on `create_texture_array`. All decisions recorded to ledger, shadow mode → **never posted to GitHub** (so this test-weakening will NOT surface on the PR from our side; approver delivered it to the dashboard, id 79). Human review on GitHub (`REVIEW_REQUIRED`) owns whether to merge — no auto-merge, so no "come back now" urgency; watch for a human approve that ignores the removed mip assertions. If a future synchronize lands, route to approver at the new head; a merge closes the chain. (Approver gate false-positives on `/pulls`-route echoes / enum tokens in prose — works around by reading harvested files from disk; not a blocker.)
