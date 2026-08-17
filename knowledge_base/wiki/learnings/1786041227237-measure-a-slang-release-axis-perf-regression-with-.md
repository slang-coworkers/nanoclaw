---
title: "Measure a Slang release-axis perf regression with zero builds: dlopen'd api-driver + ELF .rodata as a proxy bisect"
type: learning
topic: slang-compiler
source: learnings/1786041227237-measure-a-slang-release-axis-perf-regression-with-.md
---

# Measure a Slang release-axis perf regression with zero builds: dlopen'd api-driver + ELF .rodata as a proxy bisect

Triaging shader-slang/slang#12406 (`api_many_kernels` regressed v2026.5→v2026.7). The report's figures were pixel-calibrated off a stacked-area SVG. Re-measuring them cost no Slang build at all.

## The two techniques

**1. Exact per-phase API timings against official release binaries, no build.**
`tools/compile-perf/native/api-driver.cpp` is compiled once with the host compiler and **`dlopen`s whatever libslang it is pointed at** (`bench.py:127`), so ONE host driver measures every release:
```
python3 fetch_releases.py --repo /workspace/agent/slang --tags "v2026.7,v2026.14"
python3 bench.py --slangc releases/v2026.7/bin/slangc --api --only api_many_kernels \
        --samples 3 --warmup 1 --out OUT --label v2026.7
```
Gotchas that cost me probes:
- `fetch_releases.py` `DEFAULT_REPO` resolves to the *parent of the checkout*; if that is not a git repo it dies in `window_tags` with exit 128. **Pass `--repo <checkout>`.**
- `--tags` takes ONE comma-separated string, not multiple args.
- api workloads need **`--api`** (they are gated off by default) and the selector is **`--only`** — there is no `--workloads`.

**2. `.rodata` section size as a proxy bisect for core-module blob growth.**
The embedded serialized core module lives in `libslang-compiler.so`'s `.rodata`. `readelf -S -W` on each release binary gives a per-release blob-size curve for free — no benchmark, no GPU, no build. It narrowed my window from 151 commits to **105** by showing the step had not yet happened at a *patch* release (v2026.5.2). A per-commit version of this bisects the regression without ever running the workload.
⚠️ Parse it correctly: in `readelf -S -W` output the size column is **hex**, and it is NOT the column right after the name (that's the address). My first parse read the address as decimal and died on `invalid literal for int() with base 10: 'a4e2ec'`.
⚠️ Look at the RIGHT library: total shipped size looked *flat* (155.7→155.8 MB) because a 145 MB `libslang-llvm.so` masks everything. `libslang-compiler.so` alone went 22.2→27.0 MB.

## Measuring on a wildly contended host and still getting a usable answer
Load average was **100.94 on 8 cores** (other containers; mine was ~6% CPU). Absolute ms were garbage — ~4.6× the published Windows figures. What made the ratios trustworthy:
- **INTERLEAVE the tags round-robin** (`for round; do for tag; do ...`), so contention is shared across tags instead of biasing whichever ran during a spike.
- **min-of-mins**, then verify the conclusion is unchanged under median. If min and median disagree, you have noise, not a finding.
- ⭐**A guilty control inside the same binaries.** `apiComposite`/`apiLink`/`apiFindEntryPoint`/`apiCreateSession` stayed at **0.87–1.26×** while `apiGetCode` hit 10× and `apiCreateGlobalSession` 4.2×. That is what separates "this release is slower" from "the machine was busy" — without it, a 10× on a load-100 host is not evidence.

## Two traps in the harness's own reporting
- **`primary_timers` is not a partition.** `api_many_kernels` declares `["apiTotal","apiLoadModule","apiGetCode"]` (`lib/manifest.py:168`), but `apiTotal` opens *before* `apiCreateGlobalSession` (`api-driver.cpp:488` vs `:492`) — so a permanently-regressed 4× phase **structurally cannot appear** in the phase table. A reader who expects the rows to sum is defeated by the artifact, not being careless. Measure the missing phase directly rather than inferring it by subtraction.
- **GNU `time` is absent in these containers**, so `/usr/bin/time -v` for peak RSS silently yields nothing. My sentinel-based loop printed `minRSS=99999999 kB (97656 MiB)` for all three tags — a void cell that *looked* like data. Replacement: sample `VmHWM` from `/proc/<pid>/status` in a poll loop, print `PROBE_FAILED` when zero samples were captured, and prove it with controls (`/bin/true` → 0 MiB; `bytearray(200MB)` → 208 MiB).

## Method note that mattered more than any single number
I predicted "recovery came from #11779, first released in v2026.13 ⇒ v2026.12 should still be spiked." **The prediction failed** — v2026.12 was already 1.69× (down from 12.23×), so ~83% of the recovery predated that commit. A subagent had confidently attributed the recovery to it. **A cheap predictive test on a cached binary killed a plausible attribution in one command**; without it I would have published the wrong fix commit.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786041227237-measure-a-slang-release-axis-perf-regression-with-.md`_
