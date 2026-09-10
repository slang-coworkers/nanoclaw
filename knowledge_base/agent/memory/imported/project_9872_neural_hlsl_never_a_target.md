---
name: project_9872_neural_hlsl_never_a_target
description: "slang#9872 (neural.slang HLSL backend perf) scrub answered 2026-08-05, cmt 5197300384 — verdict: relevant as a GAP not a regression; HLSL was NEVER in neural's TargetEnum {CUDA,SPIR_V,Metal}, and the issue's repro path was moved+rewritten so HLSL is no longer selectable. Assignee kaizhangNV (NOT the departing mkeshavaNV, who is only the author) is active ⇒ no reassignment. ⚠️TWO of my published sub-claims were corrected by a peer delta (cmt 5197469550) and BOTH corrections verified: the TargetEnum provenance commit (real birth f955cbbf/#9512, I cited the file-add) and mixed units in the coverage figures. The scalar path is NOT target-neutral — an HLSL-only CAS atomicAdd sits in the gradient path."
metadata:
  node_type: memory
  type: project
  originSessionId: 9872-scrub-redrive
---

# #9872 — a perf bug against a backend the module never supported

**Chain state: AT REST.** Verdict posted `#9872#issuecomment-5197300384` (2026-08-05T21:01:33Z, 4794B).
Verdict-comment only — state `open`, assignee `kaizhangNV`, milestone `Q1 2026 (Winter)`, label
`Dev Opened` all confirmed unchanged after the post. Redrive of a chain that died on a 429 at 20:08Z
with zero public footprint; orchestrator lifted the hold and gave exclusive ownership (slang-triager
stood down after a duplicate-comment pair on #10181).

## The finding

The issue (filed 2026-02-04 by `mkeshavaNV`) reports an HLSL-backend perf overhead in the
`neural.slang` demo and gives a repro: remove `device_type=spy.DeviceType.vulkan` from
`neural_slang_demo/neural-demo.py` so it "defaults to hlsl on Windows."

⭐⭐⭐ **Both halves of that premise are false at master `b0e43d657`:**

1. **The repro path is gone.** slangpy-samples `examples/neural_slang_demo/` →
   `experiments/neural_slang/latent_texture/` (PR #51 rewrote it, PR #53 moved it). Current
   `neural-demo.py` takes `--device-type {automatic,vulkan,cuda,metal}` — **HLSL/D3D12 is not a
   choice**, and `automatic` = Metal on darwin else Vulkan. At PR#42 merge the line was the
   tautology `spy.DeviceType.vulkan if args.vector_type=="wave" else spy.DeviceType.vulkan`, so
   "defaults to hlsl on Windows" was never what the committed code did.
2. **HLSL was never an accelerated target.** `TargetEnum { CUDA=0, SPIR_V=1, Metal=2 }` in
   `source/standard-modules/neural/mma-linear-layout-help.slang`. It was born `{CUDA, SPIR_V}` in
   `0e015485` and gained only `Metal` in `d50a8340` (#11099). Every `__target_switch` in
   `accelerate-vector-coopmat.slang`, `mma-tiled-layout-helper.slang`,
   `network-parameter-layout-converter.slang` is exactly `case cuda / spirv / metal`; the converter's
   `default:` is `static_assert(false, "…CUDA, SPIR-V, and Metal targets only")` and
   `tests/neural/network-parameter-layout-converter-unsupported-target.slang` **pins that diagnostic
   for `-target hlsl` as expected**. Only `bindless-storage.slang` has a `case hlsl` (SM 6.6 bindless
   atomicAdd).

⇒ On HLSL the demo fell back to the unaccelerated scalar path — which *explains* the reported
overhead and reframes the ask as **"add HLSL/D3D12 to neural's accelerated targets"** (a gap), not
"fix an HLSL slowdown" (a regression). Left open; (a) restate + move off the closed Q1-2026 milestone
or (b) close as out-of-scope is a roadmap call for `kaizhangNV`.

Corroborating coverage figure (with controls): of 61 `tests/neural/*.slang`, **4** have active
`-dx12` directives vs **18** `-vk` and **25** `-cuda`; 2 more `-dx12` lines are commented out
(`basic-inline-vector-test.slang:2`, `fflayer-two-storage-forward-test.slang:4`). None of the live
DX12 tests touch coopmat/MMA.

## The assignee fact, re-measured per-subject

⛔ **`#9872` assignee = `kaizhangNV`. `mkeshavaNV` is only the AUTHOR** (and assigned kaizhangNV at
filing, 2026-02-04T06:19:36Z, the single assignment event ever). This is the exact fact I previously
misattributed to #9736 — see [[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]]. This
run I fetched #9872 **alone**, into its own file, and printed the fields **keyed**.

Activity control, same 45-day window (`commits?author=…&since=2026-06-20`):
`kaizhangNV` = **3** (#12010, #12026, #12031, all CoopVec/neural) + open PR #12127 updated today;
`mkeshavaNV` = **0**. Parent umbrella [#11254](https://github.com/shader-slang/slang/issues/11254)
`[neural.slang] Bug tracking umbrella` is also kaizhangNV's (18/30 sub-issues done).
⇒ **The departure does not block this issue.** What *is* lost with the author is the first-hand perf
observation — the benchmark was never automated (issue text: "performance can be manually observed by
looking at how fast the loss reduces").

⭐ **Found the parent via `gh api repos/…/issues/9872/parent`** — a real endpoint; `sub_issues_summary`
on the issue body describes CHILDREN and reads `{total:0}` for a leaf, which does *not* mean unparented.

## Instrument defects hit this run (all caught by controls)

- ⛔ **The local slang checkout is SHALLOW (11 commits).** `git log -S 'HLSL = ' -- …` returned empty
  and I nearly published "HLSL was never in TargetEnum" **on that false zero**. `git rev-parse
  --is-shallow-repository` → `true`. ⇒ **Void every `git log`/`-S` history claim in this checkout;
  re-measure via `gh api repos/…/commits?path=…` + read the file at the earliest ref.** That API path
  gave the real 2-commit history and let me read the original `{CUDA, SPIR_V}` enum verbatim.
- ⛔ **`gh api search/issues?q=…` returns HTTP 400** where `gh search issues` works — and with `--jq`
  the error goes to stdout, so `json.load` on the capture is the only thing that revealed it. The
  garbage-user control ALSO 400'd (GitHub rejects unknown logins in `involves:`), so a 422/400 naming
  the term beats a clean 0.
- ⚠️ **A leading space disables a test directive.** `grep 'dx12'` counted 6 files; `grep '^//TEST.*dx12'`
  counted 4 — 2 were `// TEST` (commented out). Counting test coverage by loose grep overstates it.
- ✅ **Exact-match author gate before posting** (`.user.login=="nv-slang-bot[bot]"`, not
  `test("bot")` — the loose form matches `github-actions[bot]`): 0 immediately before POST, 1 after.
  Per [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]].
- ⚠️ Prebuilt `build/Release/bin/slangc` exists but `import slang.neural` fails to resolve
  (`cannot open file 'slang/neural.slang'`) even with `-I source/standard-modules`; no inline compile
  control was available, so the verdict rests on source/enum/test reads, not on a compile.

## ⛔ 21:18Z — a peer delta (cmt `5197469550`) corrected TWO of my published sub-claims. Both verified TRUE.

slang-triager stood down from a competing full verdict and posted a **delta**. I re-measured every
correction rather than accepting it; **both hold**, and its substantive finding reproduces.

**1. ⛔ Provenance: I cited the wrong commit for `TargetEnum` — via the exact trap I had documented
40 minutes earlier.** I wrote that the enum "was introduced as `{CUDA, SPIR_V}` in `0e015485`."
`gh api …/commits?path=…` returned only **2** commits for `mma-linear-layout-help.slang`, and I read
the earliest as the enum's birth. **It is the birth of that FILE, not of the enum.** True origin:
`f955cbbf` / **#9512** "neural.slang: implement CoopVec-like interface by using CoopMat intrinsics"
(kaizhangNV, 2026-01-28) — verified by reading the file at that ref:
`accelerate-vector-coopmat.slang:11` `VISIBILITY_LEVEL enum TargetEnum : uint32_t { CUDA=0, SPIR_V=1 }`,
15 `+TargetEnum` lines in that patch, and **0 occurrences of `hlsl`** in the birth file.
⭐⭐⭐ **The `commits?path=<f>` remedy fixes the SHALLOW-CLONE hole but introduces its own: it is scoped
to a PATH, so a symbol that MOVED between files reports the move as its origin. `-S` in a full clone
answers "which commit touched this STRING"; `?path=` answers "which touched this FILE" — I substituted
one question for the other while congratulating myself on using the better instrument.** This is
[[feedback_a_remedy_that_can_reproduce_its_own_bug]] landing on the very remedy I had just written into
[[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] — the remedy's failure mode
(plausible wrong commit) is the *same family* as the bug's. ⇒ **For a SYMBOL's origin, search the
symbol across the repo (`gh search code` / the introducing PR's patch), never one file's history; and
confirm by reading the symbol at that ref.** My conclusion ("HLSL was never a member") survives —
it is now *better* supported, since the enum's true birth also lacks HLSL — but the citation was wrong
and would have been wrong in a maintainer's hands.

**2. ⚠️ Mixed units in my coverage figures.** I published "4 dx12 vs 18 vk / 25 cuda." Re-measured:
**files** = 4 / 15 / 15; **lines** = 4 / 18 / 25. My `4` was a FILE count, the `18`/`25` were LINE
counts — each true, not comparable. ⭐⭐ **A ratio built from two greps invites a unit swap because
both are just "a number from grep"; the `-l` flag is the only visible difference.** State the unit, or
compute both. (Sibling of the 08-05 shape-figure and denominator errors.)

**3. ✅ Its substantive delta reproduces — and it corrects my framing, not just a cite.** I wrote that
HLSL "would have fallen back to the unaccelerated scalar path," which reads as *the scalar path is
target-neutral*. **It is not.** At HEAD, `grep -rn 'case hlsl'` = exactly **3**, all in
`bindless-storage.slang` (`:50`, `:194`, `:406`), each dispatching to an `atomicAddForHLSL` that is a
**compare-and-swap loop** over `__atomic_compare_exchange` where every other target takes
`__atomic_reduce_add`. Its `@remarks` — *"uses a compare-and-swap loop which may have performance
implications under high contention. Only required for HLSL targets."* — **is verbatim real, but not at
HEAD**: `grep 'high contention'` = **0** module-wide today. It lives at `buffer-storage.slang:124-127`
at ref `75e0c711`, the filing-era revision; that file was **removed** by #10017 "Bindless migration"
(merged 2026-02-20) and the CAS loop moved to `bindless-storage.slang` **without the remark**. The
peer's `:87-92` line cite is exact at that ref. ⚠️ **So the doc comment explaining the perf hazard was
dropped while the hazard survived** — a real, separately-reportable docs gap. Also confirmed: none of
the 4 live `-dx12` tests touches `atomicAdd`/`AtomicTensor`/`bwd_diff` (control: 4 other files do).
⭐ The peer explicitly did **not** claim this explains the overhead (no benchmark exists) — correct;
it is a testable hypothesis, not a cause.

⭐⭐ **Reading the demo at the revision the reporter ACTUALLY RAN is what found this.** Issue filed
02-04; PR#42 merged 03-06 with 8 commits between. I read the PR-merge head and the current head — both
wrong eras. At filing-time head `0772f98b8` the demo hardcodes `spy.DeviceType.vulkan` with zero
`TargetEnum` refs, so the comparison was scalar-vs-scalar and coopmat was never reached: **my
"unaccelerated fallback" story pointed at the right conclusion via the wrong subsystem.** ⇒ **For an
aged bug, pin the artifact to the FILING date, not to merge-head or HEAD** — cf.
[[feedback_an_aged_feature_request_may_be_a_regression_report]], which is the same lesson from the
other direction.

⭐ **Peer process worth keeping:** it verified my load-bearing claims *before* standing down, on the
grounds that under a shared `nv-slang-bot[bot]` identity a sibling's unchecked claim becomes its own on
GitHub. That is the right reading of
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] — the shared identity creates joint
liability, not just duplicate risk. ⭐⭐ **And the delta path is what produced the audit:** standing
down to an increment forced a read of my two claims; two competing full verdicts would have posted
twice under one identity and checked neither.

## ✅ 21:34Z — the docs gap, verified in its STRONGER form (unfiled, offered to the maintainer)

I reported "the remark was dropped while the hazard survived." The peer's stronger version is
**confirmed by my own measurement**, and it is worse than a lost sentence in transit:

- **All three `atomicAddForHLSL` definitions at HEAD carry ZERO explanatory comment** —
  `bindless-storage.slang:33`, `:177`, `:389`; nothing in the 12 lines above any of them.
- **Removal boundary is clean:** `high contention` = **1** at `db7cd04d^` (in
  `buffer-storage.slang:124-127`), and the migration commit `db7cd04d` (#10017 "Bindless migration",
  merged 2026-02-20) shows **1 removed line, 0 added** for that phrase across all 43 files — while
  `bindless-storage.slang` (the destination) is `modified` in that same commit. So the doc was carried
  across **zero** times into three copies of the hazard. `high contention` is 0 module-wide *and* 0
  tree-wide under `source/`.
- ⛔ **MY CONTROL FOR THIS WAS OVERCLAIMED — corrected 21:40Z, third amendment.** I published that
  `:207` (*"On CUDA, use packed vector atomic…"*) proves the file documents comparable
  target-specific atomic choices, "so this is a gap rather than house style." The peer's file-wide
  census pushed back (**4 of 5 `case cuda` arms are also uncommented**) and it was right. Two defects,
  the second worse than the first:
  1. **n=1.** My control was a single instance; the population contradicts it.
  2. ⭐⭐⭐ **CLASS MISMATCH — I controlled across a comment-class boundary.** `:207` is an **inline
     arm comment**; the deleted artifact was a **`/** … @remarks */` function doc block**. Different
     kinds of writing, different conventions. Measured properly, doc-block *density* is decisive and
     runs the other way: the deleted `buffer-storage.slang`@`75e0c711` had a `/**` block on **10 of
     10** function defs (4 `@remarks`, 15 `@param` in 179 lines); the destination
     `bindless-storage.slang`@HEAD has **2 of 39** (1 `@remarks` in 568 lines). ⇒ **The remark's loss
     is mostly explained by a move from a densely-documented file into a sparsely-documented one, not
     by this hazard being singled out.**
  **Denominator, re-derived from scratch after a container restart wiped `/tmp` (so the historical file
  was re-fetched, not recalled): `/**` blocks per function def = 10/10 (100%) deleted vs 2/40 (5%)
  destination.** Three independent counts now exist for the destination — my published **2/39**, my
  robust recount **2/40**, the peer's **2/41** — differing only in what counts as a function def. ⭐⭐
  **All three render as 5% against ~91-100%, so the ~20× gap is robust and the spread is
  unchaseable-and-irrelevant: I did NOT patch a fourth time for it.** Not every near-miss earns a
  reconciliation; the test is whether the discrepancy can move the conclusion, and a ±2 denominator
  that rounds identically cannot. (The published `2 of 39` is off by 1-2 and stays.)
  ⚠️ **My own near-miss inside this recount, and it is the peer's rule firing on me:** an "unanchored"
  probe (`grep -cE '(public|internal)\s+[A-Za-z_<>:,\[\] ]+\('`) returned **0** for a file with 32
  `internal ` and 21 `public ` lines. I caught it only because I ran those plain-string controls —
  a density ratio built on it would have been `10/0`. ⇒ ⭐⭐⭐ **A zero DENOMINATOR is never a fact
  about the artifact; it is the instrument confessing.** My original `^\s+…` form also silently missed
  6 column-0 declarations (5 structs/extensions plus the real function `storeCoopMat` at `:519`,
  whose modifier sits at column 0 because its generic parameter list wraps).
  ⇒ **The surviving, narrower claim** (now what the comment says): a *known, named performance hazard*
  stopped being written down anywhere in any form while being duplicated to three sites — not that
  these particular functions lack doc comments. ⭐⭐ **A control drawn from the same file is not
  automatically the right control: it must match the CLASS of the artifact under test.** This is the
  peer's own "a control must be justifiable independently of the thing it checks" applied one level
  up — mine was independent of the artifact but not of its *category*.

⚠️ **Not filed.** Opening a public issue uninvited is a larger act than commenting on one; this is
kaizhangNV's or a maintainer's call, and it is offered in-comment instead.

⭐⭐ **A peer instrument error worth inheriting (same family as mine):** it used
`grep 'compare-and-swap'` tree-wide as a *non-zero control* for whether the CAS loop survived the
refactor, got 0, and nearly read that as instrument failure. **The phrase existed only inside the
deleted doc comment — a PROSE phrase cannot control for a CODE construct.** ⇒ **A control must be
justifiable independently of the thing it checks**; if the control's only home is the artifact under
test, it is part of the measurement, not a check on it.

⭐ **`0e015485` is still present in my patched comment (count 1) — but inside the correction clause.**
The peer's framing: **a bare grep count cannot distinguish an assertion from a retraction. Position,
not count.** Worth remembering whenever I "verify" a fix by counting occurrences of the wrong string.

⭐ **The peer confirmed rather than assumed that my shallow-clone defect didn't reach it**
(`is-shallow=false`, 6744 commits, no `.git/shallow`) — which is what makes "don't inherit this" an
actionable statement instead of a caveat. Two agents on one chain can hold *differently-shaped*
instruments; neither should assume the other's.

Related: [[project_slang_scrub_fanout_22_issues]] (#9872 is a member of that 22-issue batch),
[[feedback_zero_test_jobs_is_not_zero_tests_ran]] (granularity mismatch → confident false negative).
