---
title: "Upstream slang publishes machine-readable compile-perf data — use it instead of a local A/B build"
type: learning
topic: slang-compiler
source: learnings/1785953888171-upstream-slang-publishes-machine-readable-compile-.md
---

# Upstream slang publishes machine-readable compile-perf data — use it instead of a local A/B build

When you need compile-time perf evidence for a Slang version bump (e.g. a SlangPy `SGL_SLANG_VERSION` pin move), **do not build two arms locally first**. Upstream already publishes it:

- Repo: `shader-slang/slang-compile-perf` (rendered at https://shader-slang.org/slang-compile-perf/).
- `releases/<tag>/results.json` — per-release sweeps (28 releases, v2025.12 → v2026.14.1).
- `daily/<date>-<sha>/results.json` — daily tip-of-tree, one continuous runner series.
- Each record: `workload, bucket, size, mode, wall_ms{median,min,mean,stdev,n}, timers{<phase>{median,...}}, samples, warmup, label, cmd`. Harness is `tools/compile-perf/` in the slang repo and needs **no GPU**.

Fetch with `gh api repos/shader-slang/slang-compile-perf/contents/releases/<tag>/results.json --jq .content | base64 -d`.

**The trap that makes naive use wrong.** Different `results.json` files come from different sweep sessions on different dates (check `gh api ".../commits?path=releases/<tag>/results.json"` — you'll see "release history resync 2026-07-15" vs "nightly ToT 2026-07-30"; the `cmd` field's `perfsuite_gen_<rand>` temp dir also differs). Comparing across sessions gave me median wall **−25%** and one workload at **−88%** — mostly machine/toolchain drift, not the code.

**Always run these two controls before quoting a number:**
1. **Control phase.** Diff a phase the change cannot touch (`frontEndExecute`) alongside the target phase (`linkAndOptimizeIR`). Cross-session pair: control moved −19.4% ⇒ reject. Same-batch pair: control −0.2%, target −9.8% ⇒ trust.
2. **Negative control.** Compare an *older* release forward. `v2026.11→v2026.12` "−10.7%" with drift present. (Caveat learned from an adversarial review: this is only a drift signal if you independently believe the range is perf-neutral — real code changes can genuinely make a newer build faster.)

Prefer **same-batch** release pairs (identical commit-message date) or **adjacent-day** ToT pairs. Also: release archives and daily ToT binaries have different build provenance (PGO/LTO/toolchain), so they answer different questions — don't mix them into one quoted figure.

**Bonus signature:** to confirm a fix for a *quadratic* algorithm, check that the improvement grows with workload `size`. `caa2ff45` (simplifyIR quadratic side-effect queries): `ir_builder` size=500 −79.6% → size=4000 −97.4%. A flat-across-sizes gain is more likely drift.

**Scope limit to disclose:** this data is Slang **compile time**, not the downstream project's runtime/dispatch throughput or generated-shader quality. Faster-to-compile can in principle coexist with slower generated code, so don't let it stand in for an end-user perf claim.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785953888171-upstream-slang-publishes-machine-readable-compile-.md`_
