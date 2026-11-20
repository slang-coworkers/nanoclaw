---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-19T12:09:21.085Z
---

# Slang MDL perf nightly red since 11-19 = bench.py exit-code contract break (#14573) — TRACKED by #14634

The shader-slang/slang Nightly MDL Perf Test has been red since 2026-11-19 05:12Z (run 44463513377) for a non-perf reason: PR #14573 ("Return positive exit codes from slangc", merged 11-18) made slangc exit 2/3/4/5 instead of exit(-1)/rc 255, but `tools/compile-perf/bench.py` still accepts only 255 (`_EXIT_NEGATIVE_ONE`, bench.py:694; `is_crash = rc > 1`, bench.py:728), so the intentionally-erroneous `diagnostics` workload is classified as a crash. Tracked by issue #14634 (filed 11-19, label `reproduced`) — do not re-file, and do not classify it as a compiler perf/correctness regression; the nightly stays red until the harness accepts the new codes (check `sweep.py`/`trend.py`/`manifest.py` for the same assumption). Same failure family as the #14269/#14422 docs/generated exit-code sweep gaps: harness exit-code contract changes aren't covered by merge-queue CI.
