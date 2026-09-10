---
name: project_slang_rhi_598_optix_coopvec_capability
description: "slang-rhi#598 uncomment addCapability(Capability::optix_coopvec) — 8-month-old 1-line PR, zero reviews ever. TERMINAL: author self-merged 2026-08-11 (merge 0415316f) WITH a mine-verified compute-stage regression in main. Approver: ABSTAIN_INFRA→BLOCK RED_BUG, ledger write DENIED (no writers). Escalated to operator (ask timed out); no GitHub post (no slang-rhi posting auth)."
metadata:
  node_type: memory
  type: project
  title: slang-rhi#598 optix_coopvec capability detection
  tags:
    - slang-rhi
    - approver
    - optix
    - coopvec
    - terminal
  originSessionId: pending
---

# slang-rhi#598 — Enable `Capability::optix_coopvec` detection

**Author `skallweitNV`; branch `dev/skallweit/optix-coopvec-capability` → `main`.** A 1-line
uncomment at `src/cuda/cuda-device.cpp:301` (`// addCapability(Capability::optix_coopvec);` →
uncommented), inside `DeviceImpl::initialize` under the existing `getCooperativeVectorSupport()`
gate. Opened 2025-12-05, revived twice by `Merge branch 'main'` commits — **the code has not been
touched since Dec 2025**. The webhook (2026-08-10) was the host's generic reviewable-PR event, not a
draft→ready transition.

## TERMINAL — self-merged 2026-08-11 with a verified regression in `main`

`merged_by=skallweitNV` (the author), merge commit `0415316f`, merged head `6d84fcf2`. **Zero reviews
ever** — human or bot — in 8 months. `main`'s `cuda-device.cpp` now reads the line uncommented.
⭐ **A green self-merge on a zero-review PR whose suite cannot observe the failure mode is close to
zero evidence against the defect.**

**Approver verdict:** R1 `ABSTAIN_INFRA NO_REVIEW_SIGNAL` (harness short-circuit: `collect-reviews.sh`
exit 20 + Devin timeout ⇒ `reviewers_complete=false`), then R2 `BLOCK RED_BUG:coopvec-compute-pipeline-nvrtc-failure`,
6/6 clauses, critique-approved. **`record_decision` returned a success string but the host then denied:
`no approval-ledger writers are configured` ⇒ the BLOCK is NOT in the ledger** (R2 absent; both R1 calls
UNCONFIRMED — success returned, no read-back). ⭐⭐ **A write path with no read-back cannot be verified by
its own caller — a fleet-wide defect** ([[feedback_a_guard_can_be_inert_and_read_as_passing]]). Nothing
posted to GitHub. Operator asked via `ask_user_question` (new issue / comment / hold) → **timed out at
600 s**; escalated to `orchestrator-dashboard` so the ask is durable. A GitHub write on a third-party
repo is outward-facing and the merged-PR webhook is not posting authorization.

## Root cause (mine-verified at `v2026.12.2`, 3 limbs + causation)

Enabling `optix_coopvec` **disables CUDA coopvec lowering for every stage**, while the OptiX
headers/define are supplied **only for ray-tracing pipelines** ⇒ a compute-stage `CoopVec` shader that
compiled before now fails in NVRTC with no PTX:

1. **Lowering gate has no stage term** — `slang-emit.cpp` `CUDASource`: `if
   (!targetCaps.implies(optix_coopvec)) SLANG_PASS(lowerCooperativeVectors)`. Capability alone decides.
2. **`-DSLANG_CUDA_ENABLE_OPTIX` is ray-tracing-ONLY** — `slang-nvrtc-compiler.cpp:1341`
   (`compiler-core/`, not `source/slang/`) adds it only under `PipelineType::RayTracing`.
3. **The coopvec prelude is behind that define** — `slang-cuda-prelude.h:6519` `#ifdef
   SLANG_CUDA_ENABLE_OPTIX`, inner `#if (OPTIX_VERSION >= 90000)`.
4. **Causation** — `slang-capabilities.capdef` `alias cooperative_vector = … | _cuda_sm_9_0 | …`, so
   `_cuda_sm_9_0` alone already satisfied `cooperative_vector` before this line; `def optix_coopvec :
   _cuda_sm_9_0`. Before the PR, compute compiled; after, `identifier "OptixCoopVec" is undefined`.

**Reproduced by execution** (arms C vs D, the single variable being the capability): `C` (`-target ptx
-capability optix_coopvec`) → rc=255, no PTX; `D` (`-target ptx`) → rc=0, PTX produced.
⛔ **Scope caveat: NOT run on the pinned `v2026.12.2` build** — the local `slangc` is an untagged
post-`v2026.12.2` binary whose gate sites are content-identical to the pin, so transfer is source-level.
A pinned-build re-run is the one open technical step.

**Reachability — worse than "reachable": SESSION-WIDE.** The capability is set once at device init as a
compiler option on the **device-provided** session (`getSlangSession()`, public API), applying to every
shader compiled through *that* session. ⛔ **NARROWED:** NOT "every shader on the device" — a
caller-created session (`ShaderProgram::init` takes the session from caller-supplied components) can opt
out; `test-precompiled-module.cpp:145` is an in-tree counter-example. The bounded claim (programs built
from the device session are affected) survives and is enough for BLOCK.

## Durable lessons (this chain's calibration record)

- **CodeRabbit clean pass lands as a summary-comment EDIT, never a review row.** A harvester keying on
  `reviews[].commit_id` reads "no review on head" while the comment says current-clean. **Key on the
  rate-limit marker's ABSENCE, not the header's presence.** Cf. `#811`-R2, 2nd instance.
- **Green STEP ≠ test ran.** doctest exits 0 after skipping every device case, so `Unit Tests :: success`
  and `1289/1289 passed | 0 skipped` are byte-identical on a live-device leg and one with 835
  `SKIPPED (device not available)`. Only the capability dump + per-case `SKIPPED` count discriminate.
  [[feedback_a_doctest_tally_counts_device_skipped_cases_as_passed]], [[feedback_green_job_skipped_backend_zero_coverage]].
- ⭐ **A fabricated attribution inside a *correction* survives unchecked**, for the same reason as one
  inside a compliment — the recipient is agreeing with the substance. I told the approver they'd written
  a `source/slang/` path they never wrote (I supplied the prefix myself while hunting). **Before
  attributing a string to a peer, grep THEIR message for it.** [[feedback_a_fabrication_inside_a_compliment_survives_unchecked]].
- ⭐ **"Every X" in my own sentence is the trigger to name the X I did not check** — I inherited the
  approver's over-broad universal and widened it further to the operator, one turn after policing the same
  error in them. [[feedback_published_negative_env_claims_need_rederivation]].
- **A success string is a REQUEST ACK, not a WRITE RECEIPT** (the ledger denial above).
- **A version string with a `-N-g<sha>` suffix is a distance-from-tag, not a tag**; a bare timestamp
  version + a binary mtime predating its worktree cannot be attributed to any commit. Shallow clone makes
  `merge-base` empty and every count a graft artifact: [[feedback_shallow_clone_makes_your_head_the_graft_root]].
- **On a long-lived branch the two-head compare measures BASE DRIFT, not author work** — read
  `pulls/<n>/files` for what the PR does (still `+1/-1` here) and the compare only for what moved under it.
- **`gh api …/logs` refusing escape sequences returns 99 bytes ⇒ a substring census reads false-zero
  uniformly.** An impossibility check (9 heterogeneous legs cannot return byte-identical figures) beat
  every consistency check. [[feedback_gh_api_refusing_escape_sequences_is_a_false_zero]].
- **`collect-reviews.sh` E1 is a DISCARD bug, not a blindness bug:** `cr_summary` is fetched, parsed, and
  matched at `:156`, then the `if not cand:` early-return at `:172-183` (keyed on review ROWS only)
  writes `{"found": false}` without consulting it. A correct report with the wrong mechanism sends the
  fix to the wrong line — fix the ordering, not by adding a fetch.
- **E2 procedure gap:** no recorded state for "harness integrity failed BUT the challenger reproduced a
  red bug"; `ABSTAIN_INFRA` rows are excluded from agreement scoring, so a reproduced regression reads as
  "we learned nothing." Worth an operator decision.

## RESUME / open

**Chain is TERMINAL** (merged with the regression in `main`). The load-bearing residual: a shipped
regression needs a GitHub trail. Fires on **any** of: an operator answer authorizing a comment on merged
#598 / a new slang-rhi issue / hold; a pinned-`v2026.12.2` build re-run (the one open technical step);
a maintainer/author touching the mechanism. Two design questions for the author are now follow-up, not
gating: why was the line commented out (the Dec-2025 `windows msvc Release` failure whose log is HTTP-410
expired is the likely answer, [[feedback_an_aged_out_log_does_not_void_a_record_written_inside_retention]]),
and should the OptiX headers/define be supplied for any CUDA target that keeps the `OptixCoopVec` rep — a
slang-side design question, not purely slang-rhi. Cf. [[project_slang_rhi_811_shader_object_layout_cache_uaf]],
[[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]] (my "queued/zero OptiX" was true at dispatch,
expired 8 min later), [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] (a timeout is
not an answer — re-raise, don't let it decay to "we told someone once").
