---
title: "Slang Compiler: CI Evidence Limits"
type: concept
group: slang-grab-bag
tags: [ci, github-actions, run-history, deletion-front, evidence, nightly, mdl-perf, exit-codes, bench-py]
source_count: 2
---

# Slang Compiler: CI Evidence Limits

What Slang's GitHub Actions history can and cannot prove: the run-history deletion front that erases evidence within days, and a nightly whose red signal is a harness exit-code contract break rather than a regression.

## TL;DR

- GitHub Actions run history on shader-slang/slang is deleted at roughly 2h per hour (~5-6 days of trail); a run's logs/check-runs are only reliable for about a week.
- Don't treat vanished checks as "CI never ran" and don't reclassify old `resolved` verdicts — check the head commit date against the deletion front first.
- The Nightly MDL Perf Test red since 2026-11-19 is `bench.py`'s exit-code contract break (slangc now exits 2-5, harness accepts only 255) — tracked by #14634; not a perf/correctness regression.
- Harness exit-code contract changes are not covered by merge-queue CI — the same gap family as the #14269/#14422 docs/generated sweeps.

## The run-history deletion front (~2h/h, ~5-6 day evidence shelf life)

Measured 2026-11-19 (Slang CI babysitter): the GitHub Actions run-history deletion front is active again after stalling at 2026-10-22T18:00Z from 10-31 to 11-17 — it jumped to ~11-11 by 11-17 22:00Z and moved roughly 2h of history per hour (~5-6 days of trail). A run's logs/check-runs are only reliable for ~5-6 days; mid-flight losses observed include #14455's Nov-11 evidence run (gone 11-17) and #14470's actively-tracked falcon failure (live at 02:03Z on 11-19, entirely gone by 04:05Z). Do not treat vanished checks as "CI never ran" automatically and do not re-classify old `resolved` verdicts as misclassifications — check the head commit date against the front position first [Slang CI run-history deletion front is moving again (~2h/h, ~5-6 day evidence shelf life)](../learnings/1795061428324-slang-ci-run-history-deletion-front-is-moving-agai.md).

## MDL perf nightly red = bench.py exit-code contract break (#14573, tracked by #14634)

The Nightly MDL Perf Test has been red since 2026-11-19 05:12Z (run 44463513377) for a non-perf reason: PR #14573 ("Return positive exit codes from slangc", merged 11-18) made slangc exit 2/3/4/5 instead of exit(-1)/rc 255, but `tools/compile-perf/bench.py` still accepts only 255 (`_EXIT_NEGATIVE_ONE`, bench.py:694; `is_crash = rc > 1`, bench.py:728), so the intentionally-erroneous `diagnostics` workload is classified as a crash. Tracked by issue #14634 (label `reproduced`) — do not re-file and do not classify it as a compiler perf/correctness regression; the nightly stays red until the harness accepts the new codes (check `sweep.py`/`trend.py`/`manifest.py` for the same assumption). Same failure family as the #14269/#14422 docs/generated exit-code sweep gaps: harness exit-code contract changes aren't covered by merge-queue CI [Slang MDL perf nightly red since 11-19 = bench.py exit-code contract break (#14573) — TRACKED by #14634](../learnings/1795090161085-slang-mdl-perf-nightly-red-since-11-19-bench-py-ex.md).

**Source learnings (2):**
- [deletion front ~2h/h, ~5-6 day shelf life; check head commit date before reclassifying](../learnings/1795061428324-slang-ci-run-history-deletion-front-is-moving-agai.md)
- [bench.py accepts only rc 255 vs slangc's new 2-5; #14634 tracks; not a perf regression](../learnings/1795090161085-slang-mdl-perf-nightly-red-since-11-19-bench-py-ex.md)

_Catalog: [[wiki/index.md]]_
