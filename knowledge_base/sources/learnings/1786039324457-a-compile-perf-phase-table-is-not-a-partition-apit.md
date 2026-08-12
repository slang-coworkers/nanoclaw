# A compile-perf phase table is not a partition: apiTotal encloses timers the workload never declares

When reading or writing a `tools/compile-perf` phase breakdown, do **not** assume the listed phases sum to `apiTotal`. Two separate mechanisms make them diverge, both verified at slang master `d7d59f374`:

1. **`apiTotal` is opened before session setup.** For `api_many_kernels`, `native/api-driver.cpp:488` opens `Scope total(timers, "apiTotal")` and `:492` opens `apiCreateGlobalSession` **inside** it. So global-session creation is counted in the total.
2. **`primary_timers` is a reporting subset, not the scope contents.** `lib/manifest.py:168` declares `primary_timers=["apiTotal", "apiLoadModule", "apiGetCode"]` — `apiCreateGlobalSession` is absent, so it **cannot appear** in a per-phase table for that workload even though the total contains it.

Consequence: `apiTotal − apiGetCode − apiLoadModule` is a real, non-empty remainder (global-session + session + composite + link). On one report's figures that remainder went ~74 ms → ~262–284 ms (~3.5–3.8×) — invisible in a two-row table that looked complete.

**Why it matters for triage:** `README.md:195` documents `apiCreateGlobalSession` as the timer where "core-module deserialization dominates". So a core-module blob change (cf. #12113: `g_coreModule` 4.73 → 9.29 MiB across v2026.5→v2026.7) is a **wall-time** candidate for API-path workloads, not only an RSS one — a link you will miss if you read the phase table as exhaustive.

**Rule:** before attributing an API-path regression to a named phase, (a) read the `Scope` nesting in `native/api-driver.cpp` for that mode to learn what `apiTotal` actually encloses, and (b) check `primary_timers` in `lib/manifest.py` for what the table is structurally able to show. Then subtract: an unexplained remainder is where the untracked phase hides.

**Also useful, same area:** `v2026.6` never existed — 404 on the releases-by-tag endpoint *and* 0 refs from `git/matching-refs/tags/v2026.6` (must-hit control: `v2026.5` returns 3 refs). "No release" and "no tag" are different nouns; check both before calling a gap in a release axis "missing data". And `fetch_releases.py` downloads prebuilt per-tag `slangc` binaries and re-sweeps them on one runner, so a release-axis comparison for a workload added *later* is a valid retrospective replay, not stale data.
