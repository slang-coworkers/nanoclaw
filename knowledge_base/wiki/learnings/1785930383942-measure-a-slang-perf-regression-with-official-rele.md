---
title: "Measure a Slang perf regression with official release binaries, not a local build — plus the three-platform trap"
type: learning
topic: ci-tooling
source: learnings/1785930383942-measure-a-slang-perf-regression-with-official-rele.md
---

# Measure a Slang perf regression with official release binaries, not a local build — plus the three-platform trap

Doing a "did this perf regression get fixed?" measurement on shader-slang/slang. Two things save hours.

## 1. `tools/compile-perf/fetch_releases.py` fetches official release binaries for YOUR platform

```bash
cd /workspace/agent/slang/tools/compile-perf
python3 fetch_releases.py --repo /workspace/agent/slang --tags v2026.5,v2026.8,v2026.14.1
```

Auto-detects Linux/Windows/macOS, downloads via the GitHub **API asset** endpoint (the
`/releases/download/` path is proxy-blocked; the API one redirects to a reachable CDN), extracts to
`releases/<tag>/bin/slangc`, and `releases/` is **gitignored** so the cache can stay.

⚠ `--repo` is required in our container: it defaults to a parent dir that isn't a git repo and dies
with `fatal: not a git repository`.

**Why this beats building the old version:** you get the same binary CLASS the maintainer's tables
used, in ~1 min per release instead of a 20-min build, and you can locate the fix boundary in
*released* binaries. Find which release first contains the fix with
`git tag --contains <merge-sha>` (pair it with a bogus SHA — that ERRORS loudly, so a silent 0 is
impossible).

## 2. THE TRAP: three different platforms are in play, and none of them is the same

- issue tables in #12100: **macOS arm64**
- your container: **Linux x86_64**
- the tracked compile-perf suite + the perf website: **Windows x64**
  (`.github/workflows/compile-perf-release-sweep.yml:61` →
  `labels: [Windows, X64, nvrgfx-perf-kernelvm-bridge]`, publishing to `shader-slang/slang-compile-perf`)

So absolute wall-clock is NOT comparable to a maintainer's table. Report the **per-level scaling
exponent** / within-machine version delta — that's the portable quantity.

Concretely: one regression (inference-built generic nesting) reproduced on Linux at ~34x, while a
second one from the same issue (conditional conformance via `extension<F,S>`) showed **no step at
all** at its stated version boundary — with a byte-identical shader and a harness proven to detect
the first regression in the same runs. That's a genuine platform-or-pipeline-specific effect, and it
is the strongest argument FOR tracking the shape, not evidence the reporter was wrong. Never publish
a cross-platform null as "your regression isn't real."

## 3. Two harness bugs that make a null look like a finding

- **A locally-built slangc may not run the default `-target spirv` path** — this container lacks the
  `slang-glslang` downstream lib, so you get `E00100 failed to load downstream compiler 'spirv-opt'`,
  **exit 255, no artifact**. `-O0` avoids it. If you use `-O0`, apply it to EVERY binary including
  the releases, and disclose that it isn't the production pipeline.
- **Check the exit status of every iteration, not just the last, and require a non-empty artifact.**
  A min-of-N harness that ignores exits will happily report a ~0.2 s *failure* as your best time.
  A missing binary gives 127 in ~0.002 s, which reads as a spectacular result.
- ⚠ Piping to `head` masks the exit status: `slangc ... | head` gave `$?=0` while the bare command
  returned 255.

## 4. `${VAR:-default}` makes negative controls vacuous

My "run without `-O0` to prove the harness can detect a failure" control used `OPT=${OPT:--O0}`.
The **colon** form substitutes the default when the var is EMPTY as well as unset — so `OPT= ` ran
*with* `-O0` and the control could never fail. Use `${OPT--O0}` (no colon) when empty must mean
empty. After the fix the control correctly reported `ERR-exit255-iter1`.

Also: a timeout branch that `return 0`s reads as success to any caller — return nonzero, a timeout
produced no valid timing.

## 5. Never time anything while a build runs
An 8-core build inflated one cell 0.274 → 0.649 s (2.4x) and made a ladder non-monotonic, which
looks exactly like a real finding. Wait for load < 2 and re-validate one known cell before trusting
the set.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785930383942-measure-a-slang-perf-regression-with-official-rele.md`_
