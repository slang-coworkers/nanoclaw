---
name: project-12145-gbufferrttexgrads-d3d12-access-violation
metadata: 
  node_type: memory
  type: project
  originSessionId: ac18452e-8cea-41c3-ae5f-95cac66b7141
---

# #12145 — GBufferRTTexGrads_d3d12 access-violation CI flake (ANCHOR)

Durable CI-infra flake anchor, bot-authored by nv-slang-bot[bot] (Infra, CI
Stability), opened 2026-07-17. Same class as [[project_12137_aarch64_apt_fetch_ci_flake]].

**Signature:** `renderpasses/test_GBufferRTTexGrads_d3d12` FAILED — `Mogwai.exe`
exits **3221225477 = 0xC0000005 (STATUS_ACCESS_VIOLATION)**. D3D12 only, single
renderpass; all other ~100 Falcor tests pass on D3D12+Vulkan same run.

**Discriminator (critical):** in every occurrence `ActivationFunction_HSigmoid`
**passes** on both D3D12 and Vulkan → this is NOT the known HSigmoid fp16
numeric-tolerance red (0.0025 tol, Falcor-CI-maintainer-owned, non-actionable).
This is a genuine process crash in Mogwai on GBufferRTTexGrads specifically.

**Cost:** dominant Falcor merge-queue evictor 07-15→07-17 — 8 evictions/head-reds
across 8 unrelated PRs (#12009, #12052, #11979, #12126, #12064, #12055, #12105,
#12144). Run IDs in issue body. Crash is PR-code-independent (docs, generics,
reflection, autodiff, Metal, mimalloc all hit it) → confirmed test/infra flake.

**Ask:** maintainer fix-or-quarantine the GBufferRTTexGrads renderpass.

**07-23 20:11Z IMPACT-REFRESH POSTED (babysitter, comment 5062894889).** Issue OPEN, assigned jkwak-work, zero prior comments → non-duplicative. Babysitter re-derived from durable log (excluded 5 false matches — #12089's Falcor red is author-owned E41011 `hlsl_nvapi` link, GBuffer only "PASSED" there): **44 attributed occurrences / 16 PRs / 07-15→07-23, of which 34 merge-queue evictions across 9 PRs** (#12122 ~13×, #12151 ~12×) + receipts table extending the original 8-row body. Explicit quarantine ask on `test_GBufferRTTexGrads_d3d12`. Babysitter flagged DONE — won't re-post per-sweep; next #12145 update only if cost materially shifts (starts stranding, or count ~doubles). Quarantine ask also standing with operator (not re-pinged per-sweep). Fix-owner = jkwak.

## ⚠️ 2026-08-03 18:2xZ — ESCALATED TO OPERATOR. 17 days open, 9 days no owner activity, ZERO fix PRs.

**Main-verified via REST this session:** `state=open`, labels `Infra` + `CI Stability`, assignee **`jkwak-work`**, created `2026-07-17T12:18:31Z`, **`updated_at` `2026-07-25T19:18:33Z`** ⇒ **untouched 9 days**. Comments: exactly **one**, `5062894889` (`nv-slang-bot[bot]`, 07-23) — the impact refresh above.

⚠️ **Operational consequence — the sole comment here is OUR OWN, so any refresh is an
`EDIT-IN-PLACE` (`PATCH /repos/shader-slang/slang/issues/comments/5062894889`), never a second
`POST`.** A new comment would be a bot-on-bot echo on an issue whose comment count is the debounce
signal. Paired rule from #8785: **re-read the body live immediately before editing** — a changed
body is a signal to VERIFY, not to overwrite. (Recorded 08-04: this consequence existed only in the
MEMORY.md index line, which a compaction pass was about to shorten away — a Mode 4 near-miss.)

**ZERO fix work in flight — Main-verified, not inferred:** `search/issues repo:shader-slang/slang 12145 type:pr state:open` → **total_count 0**. `GBufferRTTexGrads type:pr` → 8 hits, **all closed and all unrelated** (#12152 hpp prototypes, #12289 CUDA `Buffer<T>`, #12151 public-by-default, #11665 operator names, #12122 profile/capability conflict). Nothing is being worked.

**Scale now 16 distinct PRs over 7 days** (babysitter, corrected method) — still the **single dominant merge-queue evictor**. The one failed merge_group batch repo-wide in 26h (run `30818074297`, #11667) was this class; auto-requeued, three later batches green, nothing stranded.

**Escalated because the bot's own channel is exhausted:** the 07-23 comment already made the quarantine ask, and the babysitter's debounce policy correctly forbids re-posting until cost materially shifts. A second bot nudge would be noise ⇒ **this needs a human**, which is exactly the case for an operator escalation rather than another GitHub write.

⛔ **Do NOT dispatch a fixer.** `Infra`-labelled, maintainer-assigned, and quarantining a test touches CI workflow YAML that the bot **cannot push** ([[project_bot_workflows_permission]]). The ask stays "maintainer fix-or-quarantine."

## ⚠️ The babysitter's ranking metric was BROKEN — treat prior "top signature" lines as unreliable

Of **143** records logged `action:"rerun"` in 7 days, only **5 were real reruns**; **138** were re-confirmations / refusals / moot deferrals mislabeled. It had ranked `check-formatting` **#1 at 31 hits** — all 31 re-confirmations of two author-owned PRs that were never rerun and never should be. Fixed: non-actions log `action:"none"`; ranking derives from reason-text by **distinct-PR spread**.

**#12145's dominance HOLDS under the corrected method** — the bug inflated a benign signature to #1 but did not manufacture #12145. ⭐**Generalizable: a counter that conflates "I considered X" with "I did X" ranks attention, not action.** Same non-discriminating-signal family as the rest of 08-03 — the count couldn't distinguish the two states it was summing.

## ⚠️ Log trap — GPU-health text is ECHOED workflow script, not a failure

Slang GPU jobs **echo** `"::error::GPU health check failed… Re-run to get a new VM"` and `nvidia-smi FAILED` **as workflow script text**. A keyword grep reads these as GPU flake. On **#12182** the real failure was a deterministic **OptiX symbol collision** (`OPTIX_ERROR_PIPELINE_LINK_ERROR`) across **8 runners / 2 OSes** — author-owned, not infra. **Discriminators are selectivity (327 passed / 1 failed) and runner spread, never keywords.** Same "the log's text doesn't mean what it says" family as [[feedback_green_job_skipped_backend_zero_coverage]].

**Routing:** forwarded to `slang-ci-babysitter` (owns CI-flake anchors) to
register #12145 as canonical anchor for this signature — use for future
flake-vs-real classification and safe requeues. Bot-authored + maintainer-directed
→ Main did NOT post a GitHub ack (bot-to-bot noise); babysitter owns the GH surface.
Thread: `gh-issue-shader-slang/slang-12145`.
