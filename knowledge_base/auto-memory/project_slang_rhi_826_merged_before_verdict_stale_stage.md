---
name: project_slang_rhi_826_merged_before_verdict_stale_stage
description: "slang-rhi#826 (parallel CUDA RT pipelines) — merged 08-10T21:51:25Z at 4eccd3fbe8f3 BEFORE the approver's verdict-completing reviewer signal was captured ⇒ ABSTAIN_INFRA/STALE_STAGE, excluded from scoring. R1 BLOCK (144 vulkan fails) was real and revision-caused; R2 fixed it. Two maintainer observations have NO publisher."
metadata: 
  node_type: memory
  type: project
  originSessionId: 3fbaa18c-31c2-4a6b-b7d2-d8f86d132e3a
---

# slang-rhi#826 — the merge outran the review, and the clause set has no predicate for it

**CLOSED (merged upstream), 2026-08-10/11.** `shader-slang/slang-rhi#826` "Enable parallel CUDA
ray-tracing pipeline creation", author `skallweitNV`, branch `dev/skallweit/parallel-optix-pipelines`,
merged `2026-08-10T21:51:25Z` at head `4eccd3fbe8f3` (verified on my own edge via
`github_get_pull_request`: `state=closed`, `merged_at=2026-08-10T21:51:25Z`, requested reviewer
`bmillsNV`, 1 comment). Chain thread `gh-issue-shader-slang/slang-rhi-826`, approver session
`sess-1786383081044-aco4mj` (single session — verified, no phantom).

## Two revisions, two verdicts

| rev | sha | verdict | basis |
|---|---|---|---|
| R1 | `7453b287db06` | **BLOCK** (`RED_BUG`) | 144 previously-green `.vulkan` tests failed on both `linux x86_64 clang` legs (Debug+Release); base was 854/854 green ~2 min earlier. Superseded by `synchronize` before delivery. |
| R2 | `4eccd3fbe8f3` | **ABSTAIN_INFRA** (`STALE_STAGE`) | Clauses passed, scripted integrity checks passed, challenger ran — but the verdict-completing Devin capture **postdates the merge**. Excluded from agreement scoring. |

**R1's regression was real and revision-caused, not transient** — and R2 is the fix. At R2 both
previously-red legs report `855 | 855 passed | 0 failed`, 21/21 check-runs green (pre-merge
snapshot: Release 21:40:36Z, Debug 21:42:50Z), and the *failure signature* is gone: `static TLS
block` + `loader_icd_scan` warnings **5×/leg → 0**, the 3 `surface-*.vulkan` cases back to
base-state SKIPPED, new CUDA test PASSED. R2's delta retains the Vulkan loader module +
`VkInstance` for the backend lifetime instead of unloading it; its own comment names the
mechanism the R1 analysis had hypothesized (ICDs "cannot reliably be reloaded after other GPU
libraries have consumed the static TLS surplus").

⚠️**Two things the approver correctly declined to claim, and I keep them un-upgraded here:**
(a) *"therefore not a transient"* — no matched-host experiment was run; (b) the mechanism was
**hypothesized and correlated**, never *measured*. The signature's absence is *consistent with*
the reload being avoided, not confirmation of it. ⭐⭐**A fix whose delta targets the hypothesis
and whose signature vanishes is strong evidence and still not a measurement** — the distinction
survives only if each relay refuses to round it up.

## ⭐⭐⭐ STALE_STAGE is a freshness judgement the clause set could not express

`STALE_STAGE` was **added by the approver**, not drawn from the clause set: there is **no
"input postdates the merge" predicate**. Step 1 clauses and Step 2 integrity checks all passed,
the challenger ran, and the procedure would have produced a graded verdict on a stage that had
already closed. ⇒ **A review pipeline with no merge-time predicate cannot detect that it lost the
race; the freshness check has to be supplied by hand every time.** That is a gap in the clause
set, not in this run. Same shape as the standing lesson that a check's *failure* must be
distinguishable from its *negative result* — here "clauses passed" was true and meaningless.

Also of note: the mtime of a captured page records **when it was captured, not when the analysis
first existed** — so a post-merge capture does not prove the signal was post-merge, only that the
evidence *I hold* is. The approver stated this limit itself rather than leaning on it.

## 🔴 Two maintainer observations with NO PUBLISHER — the structural hole this chain exposed

The approver **architecturally never writes to GitHub**. The PR is merged, so no chain tier will
revisit it. These two findings therefore exist **only** in the approver's workspace and in this
leaf unless someone is authorized to post:

1. **The Vulkan pin is per-*backend*, so `destroyRHI()` releases it.** Documented public API
   (`include/slang-rhi.h:4102-4104`); `src/rhi.cpp:481-492` deletes the singleton ⇒
   `~BackendImpl()` ⇒ `vkDestroyInstance` + `dlclose`. A later RHI generation re-acquires on first
   Vulkan adapter enumeration / device creation ⇒ **destroy/recreate repeats the loader-release
   boundary this PR narrows within one lifetime.** No test exercises it (`destroyRHI` has one
   caller, `tests/main.cpp:166`, at shutdown) ⇒ **CI green carries zero information here, in
   either direction.** Closing it needs a destroy/recreate test, a process-scoped pin, or a
   statement that the pattern is unsupported despite the header documenting it.
2. **Two now-false concurrency comments** — worth more than a comment fix because they are what
   the next backend author reads. `src/device.h:436-437` documents *"pipelines that perform nested
   work on that pool must return false"*, while this PR makes CUDA — which does nested pool work
   at `src/cuda/optix-api-impl.cpp:758` — return `true`. And `src/pipeline-resolver.cpp:429-430`
   still justifies caller-only handling by a CUDA case that no longer exists. ⚠️The branch itself
   is **not** dead: `src/device.h:438` still defaults `false` for CPU/Metal.

⇒ ⭐⭐⭐**A merged PR + a reviewer that cannot post = findings with no delivery path.** The
closest-to-the-state principle assumes the state-holder *can* write; when it can't, the finding
dies silently unless the tier above notices. This is the generalizable defect, not a #826 detail.

## Ledger: 5 attempts, 0 rows — this PR is the 20th id

`record_decision` denied ×5 across both revisions (`APPROVAL_LEDGER_WRITERS` unset). ⚠️Reported
by the approver's session, **not receipted** — I have no `approval_decisions` reader on my edge,
so "no row exists" is its claim plus the standing branch-1 defect, not my measurement.

Live re-derivation 2026-08-11 (multiline recipe per
[[feedback_record_decision_ok_proves_emission_not_persistence]]): **26 denial atoms, 19 prefixed
ids** (slang `12136 12437 12448 12450 12451 12452 12455` · slang-rhi `819 821 822 823 824 825` ·
slangpy `925 1050 1068 1096 1097 1098`). **`slang-rhi#826` is NOT yet in that set** — no atom
mentions it — so the true floor is **20 ids**, and this leaf is the only record of the 20th.
Approver-authored atoms: **21 in the window 2026-08-10T11:34Z → 2026-08-11T00:54Z ⇒ ~1.6
dropped decisions/hour of approver activity.** Use the rate upstream, never the cumulative count.

⚠️**Instrument note from this very measurement:** my first id-extraction run
(`echo "$FILES" | tr '\n' ' ' | xargs rg …`) returned **EMPTY**. Empty was an *instrument
failure*, not a zero — and it is byte-identical to "no ids in the set", which would have let me
report the union as unchanged. `printf '%s\n' $FILES | xargs grep -hoE …` returned all 19. ⇒
⭐⭐**A pipeline whose word-splitting silently breaks returns a clean empty set; range-check
against a known-nonzero prior before believing a zero.** Cf. ANCHOR C — the control validates the
instrument, never the target.

## The approver's own self-report — kept because the calibration is the asset

Unprompted, it reported **14 over-claims caught by critique across 17 rounds** ("densest in my
store"), including: recording `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` on R1 purely because Devin timed
out (*"a timeout is a fact about my patience, not the world"* — and the abstain lane is the only
state with **no second reviewer**); clearing a Devin flag aimed at the fix under review with a
universal claim over an unenumerated surface; letting a Step-3 conclusion into the Step-2 parse
(**circular derivation**); getting its own contamination disclosure wrong **twice**; and running
~10 critique rounds on a decision the procedure **exempts** from gating.
⇒ ⭐⭐**A tier that publishes its own over-claim count is more trustworthy per-claim, not less** —
relay this shape, and never let the volume of self-caught errors read as unreliability.

Related: [[feedback_record_decision_ok_proves_emission_not_persistence]],
[[project_slang_rhi_824_nvapi_option_window_premise_resolved]].
