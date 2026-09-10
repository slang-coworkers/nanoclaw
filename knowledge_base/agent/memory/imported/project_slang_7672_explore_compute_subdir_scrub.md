---
name: project_slang_7672_explore_compute_subdir_scrub
description: "slang#7672 'Explore compute subdir' (CUDA enablement in tests/compute) — assignee mkeshavaNV departed; jkiviluoto-nv asked (2026-08-05) to scrub/reassign/close. Finding: deliverable superseded by szihs's batch series; both parent trackers closed. RESUME if triager disputes the absorbed verdict."
metadata: 
  node_type: memory
  type: project
  originSessionId: 45e9b2e9-4f27-44cd-852b-ab5c168c6cae
---

**slang#7672 "Explore compute subdir"** — open since 2025-07-09, assignee `mkeshavaNV`, label `cuda`,
milestone Q3 2025 (Summer). Asked for: categorize every `tests/compute/*.slang` into 3 CUDA buckets,
enable + run buckets 2 & 3 one-by-one, report a table in a PR.

**2026-08-05: `jkiviluoto-nv` mentioned @nv-slang-bot** — Mukund won't return; scrub and assess
relevance / reassignment / closure. Real bot mention ⇒ GitHub posting authorized for this chain.

## ⛔ VERDICT RETRACTED 2026-08-05 22:10Z — do NOT act on "close as superseded"

**I was wrong; `slang-triager`'s public position is right.** I dispatched "close as superseded".
The public record refutes it: sibling comment **5197243220** recommends **rescope + reassign,
explicitly "not close"**, and the triager's own comment **5197417526** measures the successor
programme (#7723, batches #8077–#8086) closing at **~61% — 94/154 boxes ticked, 60 unticked**, nine
of ten batches closing on unticked items. **Partially absorbed ≠ superseded.** My verdict rested on
the batch series having *completed* the compute work; it did not. The original #7672 attempt also
died on *tooling* (`@claude` errored, `anthropics/claude-code-action#250`), never on infeasibility —
so nothing showed the task itself to be obsolete, and CUDA is runnable today (sibling verified a
live CUDA path: L40S + nvrtc).

⇒ Correct action: **rescope + reassign + clear the stale Q3-2025 milestone**, excluding the
category-2 files with documented platform blockers. NOT close.

⇒ ⭐⭐ **Lesson: "the work landed elsewhere" requires measuring the successor's COMPLETION, not just
its existence.** I found #7991 + #8266–#8270 merged and inferred done. Closed PRs prove *activity*;
only the checklists prove *coverage* — and they were 39% unticked with explicit reasoned skips.

## Original (now-retracted) reasoning: "superseded by absorption"

Lineage — #7672 is one **leaf of a closed tree**:
- parent **#7591** "Enable more tests for CUDA" (mkeshavaNV) — per-subdir checklist, **closed 2025-08-06
  with `- [ ] compute` still UNCHECKED**.
- burndown tracker **#7723** (assignee szihs) — closed 2025-09-19.
- sibling leaves: **#7592** hlsl-intrinsic (closed silently, zero comments — closure precedent),
  **#7964** auto-diff (closed). #7672 is the **last open leaf**.

The compute work landed anyway, by `szihs` via a different mechanism *after* #7591 closed:
PR **#7991** "Enable compute/ dir which passes" (2025-08-05), then Batch-6..10 —
**#8266/#8267/#8268/#8269/#8270** (issues #8082–#8086, bodies explicitly enumerate
"Compute Tests (97-112)/(113-128)/(129-144)/(145-154)"), plus **#8408**. All closed.
Compiler blockers found en route were spun out as their own issues — **#8313/#8314/#8315** — all closed.
⇒ The *exploration + table* deliverable is obsolete; a stale ticket, not live work.

## Mechanical state at origin/master (b0e43d65, 221 files in tests/compute)

| bucket | count |
|---|---|
| whole-file ignored (`TEST_IGNORE_FILE`/`NO_TEST`) | 5 |
| CUDA **active** | 92 |
| CUDA **explicitly disabled** | 8 |
| no CUDA, has active `COMPARE_COMPUTE` | 84 |
| no CUDA, no active `COMPARE_COMPUTE` (cuda N/A) | 32 |

Sums to 221. The 8 still-disabled: `atomics-buffer`, `default-major`, `dynamic-dispatch-11`,
`dynamic-dispatch-12`, `interface-param-partial-specialize`, `non-square-column-major`,
`spirv-multisampled-array-texel-pointer-atomic`, `texture-get-dimensions`.

⚠️ **Limits of this evidence — do not overclaim the residual.** I never ran a single test (no CUDA
GPU here), so "84 runnable without CUDA" is a *directive-shape* count, **not** 84 units of proven
actionable work — the batch series closed its own issues with boxes deliberately left unchecked, so
some of those 84 were assessed and skipped on purpose. Recommend close-as-superseded + a fresh
narrow ticket for the 8 (each needing a named blocker) over reassigning a 13-month-old
exploration ticket.

Only thematic (NOT filename) overlap found: `texture-get-dimensions` ↔ **#9661** "Improve
`GetDimensions` for CUDA" — #9661's body does **not** name the test file. `atomics-buffer` ↔ **#10683**
likewise thematic. Do not report these as tracked duplicates.

## Instrument defects hit while measuring this (both caught, both real)

1. **Shallow clone false zero.** `git log --since=2025-07-09 -- tests/compute` returned **1 commit**;
   the clone is `--depth`-limited (11 commits, `is-shallow-repository=true`). The real count via
   `gh api .../commits?path=…&since=…` is **48**. A shallow clone answers history questions with a
   confident wrong number — see [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] for the
   same false-zero shape. **Check `git rev-parse --is-shallow-repository` before any `git log` count.**
2. **Regex `^//TEST[^_A-Z]*.*-cuda` also matches `//TEST_DISABLED`** (`[^_A-Z]*` matches empty),
   and `//DISABLED_TEST` (33 uses) was missing from my disabled-set entirely. First pass reported
   cat1=82/cat2=6/cat3=133 and **did not sum to 221**; corrected pass sums exactly.
   ⇒ ⭐ **Make the buckets sum to the population — a partition that doesn't total is the cheapest
   detector of a misclassifying regex.** Enumerate the actual keyword vocabulary
   (`grep -oE '^//[A-Z_]+' | sort | uniq -c`) before trusting a hand-written directive pattern.

Routed to `slang-triager` on canonical thread `gh-issue-shader-slang/slang-7672` to verify and post
the verdict (closest-to-the-state: triage owns the out-of-scope/stale call, not me).
