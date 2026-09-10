---
name: technique_compile_perf_three_platforms_and_v_staleness
description: "slang compile-perf: the tracked suite runs WINDOWS x64 (not the platform anyone measures on); slangc -v is a CONFIGURE-time string; perf-page history is BACKFILLED so dates are slang-commit dates"
metadata:
  node_type: memory
  type: technique
  originSessionId: webhook-12100-close-2026-08-05
---

Instrument facts for `tools/compile-perf` + the perf site, established 2026-08-05 on the #12100 close (my checks + slang-triager's, cross-verified). All verified against files/workflows at master, not inferred.

## 1. THREE PLATFORMS, NO OVERLAP — always name yours

- **Tracked suite + perf site** (`shader-slang.org/slang-compile-perf`, repo `shader-slang/slang-compile-perf`): **Windows x64**. Both `.github/workflows/nightly-mdl-perf-test.yml` and `compile-perf-release-sweep.yml` pin `runs-on: labels: [Windows, X64, nvrgfx-perf-kernelvm-bridge]`, `common-setup` with `os: windows, compiler: cl, config: release`.
- **jvepsalainen-nv's issue tables** (#12100, #12103, #12113 …): **macOS arm64**, official release binaries, wall clock.
- **A fleet coworker's local measurement**: whatever the container is — **Linux x86_64**.

⇒ ⭐⭐⭐**Absolute times from these three sources are NEVER comparable, and the suite says so about its own history**: the workflow comment records that the pre-VM `nvrgfx-perf` pool was retired 2026-07 and "timings recorded before the migration may show a step at the boundary." **The valid comparisons are (a) same box, two binaries, and (b) the depth-scaling exponent.** Publishing a cross-platform absolute delta as agreement/disagreement is the error this note exists to prevent.
⚠️**A regression measured on macOS and absent on Linux is a PLATFORM-DEPENDENT result, not a refutation** — and if the guard would run on Windows, its existence there is *unmeasured by anyone*. That is an argument FOR adding the workload, not against the original report. (Requires the instrument to carry a positive control that reproduces a KNOWN regression in the same harness — otherwise "absent" is indistinguishable from a broken harness.)

## 2. `slangc -v` IS A CONFIGURE-TIME STRING — never use it for build freshness

A Release build at HEAD `d2b405d31` printed `2026.13.1-50-g3649fb982` — **82 commits stale**, because the version is stamped at CMake configure time, not compile time. ⇒ **`-v` cannot answer "is this binary my HEAD?"**
Use instead: **binary mtime vs the HEAD commit date**, plus **`git merge-base --is-ancestor <fix-sha> HEAD`** to prove the binary's tree contains the commit you care about. (Both used successfully here to prove HEAD contained `c8d02ae59`.)

## 3. Fetching official binaries beats building — and gives release-to-release comparability

`tools/compile-perf/fetch_releases.py` fetches **official release binaries, host-auto-detected** (Linux included). Comparing official-release→official-release keeps the binary CLASS constant (only OS/arch differs) and needs no build at all. Pair with **`git tag --contains <sha>`** to find the first RELEASE containing a fix ⇒ the fix boundary becomes measurable in released binaries.
Worked example: `c8d02ae59` (#12106) → **absent in v2026.13.1, present in v2026.14** (`gh api compare/c8d02ae59...v2026.13.1` = `behind`, `...v2026.14` = `ahead`). ⛔**Debug is not comparable to release binaries** — don't mix.

## 4. Perf-page history is BACKFILLED — the dates are SLANG-commit dates

`generic_nesting` entered the manifest only with #12086 (`429163082`, merged 07-15T10:22Z) — verified ABSENT at the parent `bee6400c2` — yet its page shows data from Jul 11. The nightly workflow has a **`Checkout suite ref (backfill)`** step (sparse-checkout `tools/compile-perf` + `include`) that runs a chosen SUITE version against older slang commits.
⇒ **A step on the page is between two slang commits measured by ONE suite version — which is exactly what makes it attributable to the compiler.** Don't read page dates as measurement dates.
**Confound check that makes an attribution stick** (ran it for the Jul15→16 96.8% step, it held): (a) `gh api "commits?path=tools/compile-perf/lib/manifest.py&since=<A>&until=<B>"` must be **EMPTY** — no suite change between the two data points; (b) the generator body must be **byte-identical** across the window (`sed -n '/^def gen_X(/,/^def gen_next(/p' | md5sum` at both refs — was `2cbd8deb…` at both). (c) Check the runner-pool migration date is OUTSIDE your window: the migration was **#11950 / `97f778022`, 07-07**, i.e. ~8 days BEFORE the Jul15→16 step ⇒ **it does not confound that step, so don't hedge the attribution for it.**
⚠️Nightly *scheduled* runs 07-16/17/18 all show `conclusion=failure`; the successful points near the step came from `workflow_dispatch` runs. Data on the page ≠ a green nightly.

## 5. Workload-set enumeration (closed set)

`manifest.py:86` `WORKLOADS = [` is the **single registration site** — no `+=`/`.append`/`.extend`/`.insert` anywhere in `lib/`. 41 workloads, of which exactly **3 are depth-axis**: `generic_nesting`, `generic_nesting_eval`, `interface_depth`. ⭐**All three build nesting by `typealias`; NONE by call inference** — decisive cheap check: **0 occurrences of `wrap(` in `lib/workloads.py`, vs 6 `typealias T`.** `generic_nesting_eval` SOUNDS like the inference/eval shape and is the typealias chain with a method call.

Related: [[project_12100_generic_nesting_exponential_compile_parked]] · [[project_12139_shallow_generic_compile_regression_12106]] · [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]
