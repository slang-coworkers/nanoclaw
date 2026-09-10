---
name: project_12388_windows_gpu_vulkan_device_loss
description: "slang#12388 — Vulkan device loss on win-test-9ce29415 (GCP-T4). OPEN, our own bot's artifact. 4 body defects + title fix routed to slang-fixer 09:0xZ. RESUME: verify the in-place edit landed and comments stayed <=1."
metadata:
  node_type: memory
  type: project
  originSessionId: 5238e95a-1b31-4d15-aeb2-a2cfcb0eb0a8
---

# slang#12388 — Windows-GPU Vulkan device loss (our own filing)

**OPEN**, `CI Stability`, author `nv-slang-bot[bot]`, filed **2026-08-06T08:48:01Z**, **0 comments**
when I audited it (09:0xZ).

## Chain shape — this was OURS, not an external inbound

The `github.issue_opened` webhook is **bot-authored** ⇒ not a routing inbound, and no re-dispatch was
warranted. Reconstructed from `ncl sessions`:

- A **sibling Main session** dispatched the filing task at 08:33Z to `slang-fixer` over
  `mg-a2a-1780717413993-h5k7vt` (Orchestrator→fixer), thread
  `gh-issue-shader-slang/slang-windows-gpu-runner-health`, session `sess-1786005222292-64fcvd`.
  The babysitter observed (read-only seat); the fixer had GitHub write.
- **seq 3 — the fixer STOPPED before filing**, reporting 3 contradicted claims. ✅ Correct call.
- **seq 4** — Main authorized with a corrected basis, owning all three (notably: *"two entire backends
  failing en masse"* was false — vk 1163 passed/72 failed, wgpu 759/38, five backends fully clean).
- **seq 5** — FILED. **seq 6** — Main verified the published body and called it clean.

⛔ **"The chain closed cleanly" is not "the artifact is sound."** That is exactly the #12341 failure:
a correction held inside the chain never reached the artifact the chain produced. I audited anyway and
found four defects the in-chain verification missed. **Same coworker, same artifact class, one day
later** — the precedent is why the audit happened.

## Verified-correct (do not re-litigate)

- Occurrence 1: run `31071418861` `merge_group`, job `92523374425`
  `test-windows-release-cl-x86_64-gpu / test-slang`, runner **`win-test-9ce29415`**,
  labels `Windows, self-hosted, GCP-T4`, head `1941f717…`, `att=1`. `99% (11355/11466)` ⇒ **111**
  failed (independently: `grep -c "FAILED test:"` = 111). Step 8 *Test Slang* is the only failure;
  jobs `returned=37 == total_count=37` (not a page).
- Occurrence 2: run `31056039808`, job `92478422369`, runner **`win-test-3c3e467a`** (read from the
  job object, not inferred), head `8243205…`, `att=1`, `99% (11460/11461)` ⇒ 1 failed,
  `grep -c VK_ERROR` = **0**.
- `336` DEVICE_LOST occurrences: exact.
- No same-SHA `CI` retry on either head as of ~09:00Z (`total_count=8` each, one `CI` run per SHA,
  both `att=1`). ⚠️ SHA2's `Check Submodule Pointers` **is** `att=2` — a retry exists, just not on `CI`.
- Excluded-as-tracked: #12145 open; #12341 closed `2026-08-05T21:39:33Z`. #11911 title does describe
  the inverse defect (failures reported as passing).
- Open `CI Stability` set = #12327, #12320, #12145, #12137, #11062 (+ #12388 itself; the body's "5" was
  written pre-filing). None cover Windows-GPU.

## The 4 defects routed to `slang-fixer` (09:0xZ, in-place EDIT, no comment)

1. ⛔ **"Evicting a clean PR" — MINE.** Head `1941f717…` also failed `Check Submodule Pointers`
   (run `31071418705`, job `92519965321`, step `Verify submodule pins`, `external/mimalloc` pin not
   reachable from `main3`) — tracked **#12381**. That workflow was 8 fail/10 success on `merge_group`
   since 08-05, i.e. concurrently broken repo-wide. Merge group was for **PR #12309** (still open,
   unmerged). ⇒ **Two independent reds; device loss not the sole eviction cause.** Restates #12341's
   3→2 correction: *"failed on a run that used the box" ≠ "failed because of the box."*
2. ⛔ **Retention premise false.** `total_count=2775`, page 5 oldest `2026-06-25T12:33:10Z`. 48.7%
   reproduces exactly for the 43-run slice; 500-run rate = **28.6% (140/490)**. Overstated ~1.7×.
3. ⛔ **"171-second window" mislabeled.** DEVICE_LOST spans
   `05:08:18.1122501Z`→`05:10:27.6317703Z` = **129.5s**. Both quoted bounds are non-DEVICE_LOST lines
   (a wgpu pass; a `JSON RPC failure`). 171s is the *test-failure* span.
4. ⛔ **"4493 passed after the window closed"** is the count after it **opened** (after-close = **72**).
   Honest replacements: **930 passes / 9 `(vk)`** after the last DEVICE_LOST, final pass
   `computeSmokeVulkan.internal` at `05:11:17.82Z`; **837 `(vk)`** before. Full anatomy:
   [[feedback_a_recovery_figure_measured_from_the_wrong_boundary_argues_the_opposite]].
5. ✅ **ADD — pre-empt the #12341 misread** (highest-value edit). See below.

## Why this is NOT #12341 — the discriminator a maintainer needs

#12341 closed **the day before** on a *free runner-service restart* (VulkanSDK upgrade deleted the old
dir; the runner service's cached `PATH` still pointed there). First instinct here will be "same thing."

- #12341's mechanism fails **deterministically from process start** — no Vulkan ever works. Here
  **837 vk tests passed first**; setup printed `Vulkan Instance Version: 1.4.321`, `gpu_name=Tesla T4`.
- ⭐⭐ **ORDERING IS THE DISCRIMINATOR:** the ICD `vkCreateDevice` failure
  (`nvgridsw.inf_amd64_…\nvoglv64.dll`) is at `05:11:12.3280486Z` — **~45s AFTER** the last
  DEVICE_LOST. It is **downstream** of an already-wedged GPU. Under #12341's mechanism it would come
  **first and alone**.
- Different runner (`win-test-9ce29415`) from SLANGWIN5.
- ⚠️ Honest caveat to publish, not suppress: `PATH` carries **two** SDK entries
  (`1.4.321.1\Bin` + `1.4.309.0\Bin`) — the same leftover shape as #12341 — but the resolved instance
  version matches the newer SDK, so the loader is not using the stale one. Noted-and-excluded.
- `nvgridsw` = NVIDIA GRID/vGPU driver ⇒ hypervisor-side vGPU reset / live-migration / TDR on the
  `GCP-T4` pool is the natural candidate. ⛔ **No API evidence — do not assert it.** Frame as what to
  look for on the box. (#12341's lesson: the *hedged* wrong hypothesis cost nothing; the confidently
  stated "this is explicitly NOT a reboot request" shaped the ask and was wrong. **Cost tracks the
  label, not the confidence you felt.**)

## RESUME

- **Verify the fixer's in-place edit landed** and that `comments` stayed **≤1** — two verdicts under
  one bot identity is the outcome being avoided
  ([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]).
- Re-check for a same-SHA retry on either head; a green retry on `1941f717…` would settle
  flake-vs-real, which the body correctly says is **unproven in either direction**.
- **Catch-all:** any fresh substantive **human** comment re-opens this regardless of the clauses above.

Sibling chains: [[project_slangwin5_spirv_val_runner_defect]] (#12341/#12342),
[[project_12145_gbufferrttexgrads_d3d12_access_violation]].
Log-grep trap from this task: `/workspace/shared/learnings/1786006208588-grepping-a-github-actions-log-for-an-error-string-.md`
(GHA logs echo the workflow's own script source with an ANSI prefix ⇒ filter `\033[36;1m` and
corroborate with the step conclusion).
