---
name: project_9872_neural_hlsl_never_a_target
description: "slang#9872 (neural.slang HLSL backend perf) scrub answered 2026-08-05, cmt 5197300384 — verdict: relevant as a GAP not a regression; HLSL was NEVER in neural's TargetEnum {CUDA,SPIR_V,Metal}, and the issue's repro path was moved+rewritten so HLSL is no longer selectable. Assignee kaizhangNV (NOT the departing mkeshavaNV, who is only the author) is active ⇒ no reassignment. ⚠️TWO of my published sub-claims were corrected by a peer delta (cmt 5197469550) and BOTH corrections verified: the TargetEnum provenance commit (real birth f955cbbf/#9512, I cited the file-add) and mixed units in the coverage figures. The scalar path is NOT target-neutral — an HLSL-only CAS atomicAdd sits in the gradient path."
metadata:
  node_type: memory
  type: project
  originSessionId: 9872-scrub-redrive
---

# #9872 — a perf bug against a backend the module never supported

**Chain state: AT REST.** Verdict posted `#9872#issuecomment-5197300384` (2026-08-05T21:01:33Z).
Verdict-comment only: state `open`, assignee `kaizhangNV`, milestone `Q1 2026 (Winter)`, label `Dev Opened`
unchanged after the post. Redrive of a chain that died on a 429 at 20:08Z with zero public footprint;
slang-triager stood down and later posted a delta (cmt `5197469550`). Member of the
[[project_slang_scrub_fanout_22_issues]] batch.

## The finding

The issue (2026-02-04, `mkeshavaNV`) reports HLSL-backend perf overhead in the `neural.slang` demo, with the
repro "remove `device_type=spy.DeviceType.vulkan` … defaults to hlsl on Windows." **Both halves of that
premise are false at master `b0e43d657`:**

1. **The repro path is gone.** slangpy-samples `examples/neural_slang_demo/` →
   `experiments/neural_slang/latent_texture/` (PR #51 rewrote, PR #53 moved). Current `neural-demo.py` takes
   `--device-type {automatic,vulkan,cuda,metal}`; HLSL/D3D12 is not a choice. At PR #42 merge the line was a
   tautology selecting vulkan either way.
2. **HLSL was never an accelerated target.** `TargetEnum { CUDA=0, SPIR_V=1, Metal=2 }`
   (`source/standard-modules/neural/mma-linear-layout-help.slang`). Born `{CUDA, SPIR_V}` in
   **`f955cbbf` / #9512** (kaizhangNV, 2026-01-28, 0 occurrences of `hlsl` in the birth file); `Metal` added
   in `d50a8340` (#11099). Every `__target_switch` in the accelerate/tiled/converter files is exactly
   `cuda / spirv / metal`; the converter's `default:` is a `static_assert`, and
   `tests/neural/network-parameter-layout-converter-unsupported-target.slang` pins that diagnostic for
   `-target hlsl`.

⇒ The ask is **"add HLSL/D3D12 to neural's accelerated targets"** (a gap), not "fix an HLSL slowdown" (a
regression). Left open; restating it off the closed milestone, or closing as out-of-scope, is kaizhangNV's
roadmap call.

**Coverage, with units:** of 61 `tests/neural/*.slang`, files = 4 `-dx12` / 15 `-vk` / 15 `-cuda`; lines =
4 / 18 / 25. Two more `-dx12` lines are commented out (`// TEST` with a space disables the directive). None of
the live DX12 tests touch coopmat/MMA or `atomicAdd`/`AtomicTensor`/`bwd_diff`.

**The scalar path is not target-neutral.** At HEAD `case hlsl` appears exactly 3× (`bindless-storage.slang`
`:50`, `:194`, `:406`), each dispatching to `atomicAddForHLSL`, a compare-and-swap loop where other targets use
`__atomic_reduce_add`. A testable hypothesis for the overhead, not a cause; no benchmark exists (the author's
observation was manual, "how fast the loss reduces").

## Assignee, measured per-subject

**Assignee = `kaizhangNV`; `mkeshavaNV` is only the author** (assigned kaizhangNV at filing, the only
assignment event). Same 45-day window: kaizhangNV = 3 neural commits + open PR #12127; mkeshavaNV = 0. Parent
umbrella #11254 is also kaizhangNV's (found via `gh api repos/…/issues/9872/parent`; `sub_issues_summary`
describes children, so `{total:0}` does not mean unparented). ⇒ The author's departure doesn't block it. This
is the fact I once misattributed to #9736: [[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]].

## Docs gap (verified, unfiled, offered in-comment)

The `@remarks` explaining the CAS hazard (*"may have performance implications under high contention. Only
required for HLSL targets."*) lived at `buffer-storage.slang:124-127`@`75e0c711`. #10017 "Bindless migration"
(`db7cd04d`, merged 2026-02-20) removed that file and moved the CAS loop to `bindless-storage.slang` with
**1 line removed, 0 added** for the phrase. At HEAD all three `atomicAddForHLSL` definitions (`:33`, `:177`,
`:389`) carry no comment; `high contention` is 0 under `source/`. Narrowed claim: a known, named hazard stopped
being written down while being duplicated to three sites. Filing an issue uninvited is kaizhangNV's or a
maintainer's call. How I overclaimed the control for this, and the corrected measurement:
[[feedback_a_control_must_match_the_class_of_the_artifact]].

## Lessons from this run

- **Shallow checkout (11 commits)** gave a false-zero `git log -S`; the `commits?path=` remedy then reported the
  file's birth as the symbol's. Both, with the fix (search the symbol repo-wide, confirm at that ref):
  [[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] · [[feedback_a_remedy_that_can_reproduce_its_own_bug]].
- **Mixed units:** my published "4 dx12 vs 18 vk / 25 cuda" put a file count beside line counts. A ratio from
  two greps invites a unit swap because `-l` is the only visible difference; state the unit.
- **Pin an aged bug to its FILING date.** At filing-time head `0772f98b8` the demo hardcoded vulkan with zero
  `TargetEnum` refs, so the comparison was scalar-vs-scalar and my "unaccelerated fallback" story reached the
  right conclusion via the wrong subsystem. Cf. [[feedback_an_aged_feature_request_may_be_a_regression_report]].
- **`gh api search/issues?q=…` returns HTTP 400** where `gh search issues` works, and with `--jq` the error
  goes to stdout; unknown logins in `involves:` also 400.
- **Exact-match author gate before posting** (`.user.login=="nv-slang-bot[bot]"`, not `test("bot")`): 0 before,
  1 after. The peer verified my claims before standing down because under a shared bot identity a sibling's
  unchecked claim becomes its own; the delta path is what produced the audit
  ([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]).
- No compile control: prebuilt `slangc` couldn't resolve `import slang.neural`, so the verdict rests on
  source/enum/test reads. The peer confirmed its own clone was full (6744 commits) rather than assuming my
  defect didn't reach it.

Related: [[feedback_zero_test_jobs_is_not_zero_tests_ran]].
