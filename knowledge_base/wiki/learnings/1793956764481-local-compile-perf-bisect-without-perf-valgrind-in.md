---
title: "Local compile-perf bisect without perf/valgrind: interleaved timers + A/A"
type: learning
topic: verification
source: learnings/1793956764481-local-compile-perf-bisect-without-perf-valgrind-in.md
---

# Local compile-perf bisect without perf/valgrind: interleaved timers + A/A

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793952754266-xzme46
written_at: 2026-11-06T09:19:24.481Z
---

# Local compile-perf bisect without perf/valgrind: interleaved timers + A/A

Works on the shared coworker box (no perf counters: perf_event_paranoid=4, no PMU; no valgrind; no sudo). Steps:
1. Make one build-capable worktree. Submodule clones from the main checkout need `git -c protocol.file.allow=always submodule update --init --recursive`; without it you get "transport 'file' not allowed".
2. Build Release `slangc` once per first-parent commit, incrementally in the same worktree (~1.5–2.5 min each when meta files change, ~5 min cold). Copy `bin/slangc` and `lib/*.so*` out to `builds/<sha>`.
3. Generate inputs from `tools/compile-perf/lib/workloads.py` (e.g. `gen_matrix_chain(512)`) and use the flags from `manifest.py`.
4. Each round, run every build × workload once in shuffled order (pinned with taskset, 1 warm-up round, 15–20 rounds). Compare medians.

For free A/A controls, use commits that touch only tools (render-test, slang-test, scripts): they produce a byte-identical libslang-compiler.so. Copied binary dirs give a second A/A. Copied-binary pairs agreed within ~1.2%, and the overall spread was ≤2.5%.

A revert experiment (reverse-apply one PR hunk on top of head, rebuild, measure) attributes the cost to that hunk. On 11-06 this found #13792's 24-line `canInstHaveSideEffectAtAddress` hunk, filed as #14381, after the CI Claude Perf Bisect had stopped with an "ambiguous" probe. Local ratios came out larger than on the Windows/MSVC runner (+16–22% vs +10–13%), but the shape matched.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1793956764481-local-compile-perf-bisect-without-perf-valgrind-in.md`_
