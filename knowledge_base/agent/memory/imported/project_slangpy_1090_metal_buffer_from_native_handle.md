---
type: project
name: project_slangpy_1090_metal_buffer_from_native_handle
description: "slangpy#1090 (fknfilewalker/Lukas Lipp) Device::create_buffer_from_native_handle — 4 approver rounds R1→R4; R2 BLOCK (vulkan import undefined-state crash) fixed upstream via slang-rhi#813 and stays cleared; final ABSTAIN_POLICY OPEN_GAP (size-check gap). Closed on my side; RESUME = human maintainer ccummingsNV dismisses his CHANGES_REQUESTED, or a synchronize webhook. Round-by-round narrative pruned 2026-09-04."
---

# slangpy#1090 — `Device::create_buffer_from_native_handle` (Metal buffer import)

- **PR:** shader-slang/slangpy#1090, author `fknfilewalker` / Lukas Lipp (non-bot human contributor). Bumps `external/slang-rhi`.
- **Routing:** a reviewable webhook (`pr_ready_for_review`) goes to **`slangpy-pr-approver` only** (thread `gh-issue-shader-slang/slangpy-1090`), never a reviewer/fixer ([[feedback_webhook_dispatch_by_event]]). The approver **never posts to GitHub** and I must not post either ([[feedback_approver_never_posts_route_reviewer]]).

## Final state — chain closed on my side

**ABSTAIN_POLICY (`OPEN_GAP`)** after 4 rounds (R1 abstain → R2 **BLOCK** → R3 block cleared → R4 abstain, holding on the same residual gap). Ledger written each round, critique gate passed, **nothing posted to GitHub**.

- **R2 BLOCK (`VERIFIED_BUG:vulkan_import_undefined_state`) is fixed and stays cleared.** The new test crashed on `[DeviceType.vulkan]` deterministically on 4 legs; root cause was a **pre-existing rhi defect newly *reached*** (not introduced): `createBufferFromNativeHandle` omitted `fixupBufferDesc`, so an imported buffer carried `ResourceState::Undefined` into `requireDefaultStates()` → `commitBarriers` → `calcPipelineStageFlags(...,src=false)` → `SLANG_RHI_ASSERT(src)` → abort. Metal passed because `metal-buffer.cpp` calls `fixupBufferDesc`; d3d12 survived only via `Undefined → COMMON`. Fixed upstream by **slang-rhi#813** ("Apply fixupBufferDesc when importing buffers", merged 08-07) and pinned in; vulkan `[vulkan]` then PASSED by name on all 4 previously-crashing legs (`4139→4148` = +8 collected).
- **Residual gap it abstains on:** `device.h:404` documents *"size must not exceed the native allocation"*, but **only Metal enforces it** — vulkan/d3d12/wgpu type-check the handle and never size-check, all Python-reachable. Plus `m_memory` still uninitialized in the vulkan import path (**real-but-unfired**: the `to_numpy()` readback builds a separate staging buffer, so it never maps the imported `m_memory` — a real defect in the wrong causal role, correctly not folded into the BLOCK).

## RESUME triggers

- **Human maintainer** `ccummingsNV` has an open `CHANGES_REQUESTED` pinned to the original head `5c384a20b11b` (his 2 asks — throw-not-implemented + add a test — were both met); **only he can dismiss it.** A non-bot review/comment is the resume signal.
- A `synchronize` webhook → **debounce the re-run, never the inbound scan** ([[feedback_debounce_approver_dispatch_deterministic_abstain]]): check head SHA moved, file scope, and scan `pulls/1090/reviews` **plus** `issues/1090/comments` **plus** `pulls/1090/comments` for non-bot input ([[feedback_inbound_scan_must_cover_issue_comments_not_just_reviews]] — a blocking directive can arrive as a plain issue comment).
- A non-bot comment on a chain I've closed **re-opens it**.

## Durable lessons this chain earned

- ⭐⭐⭐ **The GitHub `compare/<base>...<head>` three-dot trap.** `compare` reports the diff from the **merge-base**, so any two bases sharing a merge-base with the head return **byte-identical** file lists, counts, even a hash of the sorted membership — the agreement is *structural*, not lucky, and `behind_by` is the only differing field. No output dimension distinguishes the queries; only the inputs do. **Remedies:** on a `diverged` compare, switch instrument to `pulls/N/files` (or the merge-base); **print the provenance string with the figure** (`compare/<base>...<head> -> N files`); when reconciling with a peer, **compare inputs not outputs** ("which range are you on?"). General form: *agreement on a RESULT is never evidence of agreement on the QUERY* (inverse of [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]).
- ⭐⭐⭐ **A mechanism that cannot explain why the PASSING cases pass is not a root cause yet.** The per-device cut (d3d12 PASS · cuda PASS · `_invalid[vulkan]` PASS · only `[vulkan]` dies) forced the real boundary out. Name the case your mechanism doesn't cover (cuda passes via the not-implemented branch) rather than rounding up. A mechanism that **predicts an uninspected case** and is then confirmed (prediction-then-fetch) beats one that merely accounts for the prompting case ([[feedback_mechanism_must_predict_observed_coordinates]]).
- ⭐⭐ **Registration ≠ execution; a green job ≠ executed coverage.** macOS `runs-on: macos-latest` is paravirtual and skips Metal GPU tests — read the pytest summary for the test's name (PASSED vs SKIPPED), not the job conclusion ([[feedback_green_job_skipped_backend_zero_coverage]]). Here the Metal test genuinely executed (`PASSED [metal]`), which is what re-dispatch existed to force.
- ⭐⭐ **A gitlink-only delta (`external/slang-rhi +1/-1`) must never be debounced as trivial** — it can carry ~250 lines under "update slang-rhi", satisfying/invalidating premises on **other** live chains (e.g. #808 arriving here touches the [[project_slangpy_1089_shader_cache_path_vulkan_segv]] surface). Enumerate the bump's commits against your other chains. Mirror: **a file *leaving* a PR's diff can mean "merged upstream", not "reverted"** — check the base's value before reading a disappearance as a regression.
- ⭐⭐ **Pre-registration converts a post-hoc reading into a test** — state the pass/skip bar (and which device rows) *before* the legs land, then read by test name against a non-zero line-count control. A pass-count *increase* is a stronger signal than a green conclusion.
- ⭐⭐ **Ask for the UNDER-claim direction by name.** Repeated narrowing rounds bias toward under-claiming, and reviewers optimise for over-claims, so under-claiming has no natural detector — explicitly asking "did I under-claim anywhere?" is what surfaced the missed wgpu backend. Verify a fix by grepping the **concept**, not the phrase you just changed, with a matcher that spans newlines ([[feedback_audit_grep_false_negatives_asymmetric]], [[feedback_four_states_where_the_decisive_check_feels_unnecessary]]).
- ⭐⭐ **"A hit is not a predicate; read the operator" has a second half: also count the hits.** Both are membership claims about the same grep. And a zero from a platform-specific pattern / wrong file is a claim about the *pattern*, not the platform/code (Linux emitted no crashpad section at all; d3d12's import path lives in `d3d12-device.cpp`, not `d3d12-buffer.cpp`).

## Adjacency

Metal + native-handle import shares surface with [[project_10842_metal_descriptorhandle_runtime]] and [[project_11970_metal_bindless_msl]]; approver-pipeline defects catalogued in [[project_approver_pipeline_defects_devin_fetch_ci_green]].
