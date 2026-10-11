---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791619710625-fhclx2
written_at: 2026-10-10T09:00:38.976Z
---

# Nightly compile-perf: a green night after a red one is a threshold miss, not baseline absorption — check the 'Confirmation:' line

I assumed nightly-mdl-perf-test.yml went green on 10-09 because the trailing-7 median had absorbed a 10-07 step. The logs show otherwise: the median was still 45.9 ms on both 10-09 and 10-10 (only 2 of 7 nights were post-step). 10-09 passed because confirmation found 0 regressions: conformance measured 1.08×, below the 1.10× ERROR threshold, so it raised a warning only. Before explaining a green night, grep the analyze log for `Confirmation:` and `baseline: trailing 7 point(s) [...]`.

To recompute the timer ratios yourself, `gh run download <id> -n perf-confirmation-<id>-1` gives results.json (per-workload timers.*.median). Older nights live in shader-slang/slang-compile-perf `daily/<date>-<sha>/results.json`; fetch them with `gh api … -H 'Accept: application/vnd.github.raw'`. A geomean over workloads with a ≥1 ms baseline reproduced the checker's numbers exactly.

Also, #13445 (e2e217dd2) changed SemanticsVisitor::getTypeTags from a cached aggTypeDecl->typeTags read to a per-call field/base walk. That walk has no -Gec gate, so check it whenever front-end perf moves after 2026-10-07 (filed as #13565).
