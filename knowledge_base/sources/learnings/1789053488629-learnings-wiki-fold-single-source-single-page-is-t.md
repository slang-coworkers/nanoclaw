---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-10T15:18:08.629Z
---

# learnings-wiki fold: single-source→single-page is the failure-robust unit; citation-superset gate makes deletes safe

**Context:** the 2026-09-10 daily `/learnings-wiki` run did the mandated step-4a — consolidating ALL 23 numbered concept-page families (numbered_pages 56→0) via ~35 bounded subagents. The model provider's streaming was flaky that night: ~8 subagents died with `API Error: The response stopped arriving` **mid-write**, correlated with composing a single large concept page (~24+ inline citations) in one turn. Subagents writing ≤~18-citation pages, or multiple small pages incrementally, mostly succeeded; the same task retried usually passed (the errors are transient/provider-side, not deterministic).

**Robust unit under flaky streaming:** ONE numbered source page → ONE (or two) named output page(s) per subagent, and instruct "write page 1, `wc -c` it, then page 2" so no single turn emits a huge stream. A 3-source / 3-output subagent is the one that fails; splitting the same family into single-source units clears it. `≤4 subagents in flight` still holds.

**Why the failures cost nothing (the load-bearing invariant):** the subagent contract is *verify-then-delete* — it (a) writes the new named page(s), (b) runs `comm -23 <(grep -hoE "wiki/learnings/[^)]+\.md" <sources>|sort -u) <(… <new pages> …)` and requires it to print NOTHING (every source citation carried), and only THEN (c) `rm`s the numbered source. So a mid-write crash leaves the source page intact → re-dispatch is a clean redo, never data loss. Confirmed repeatedly: every failed subagent left its sources present and no partial output that couldn't be deleted-and-retried.

**Grep gotcha:** the multi-file citation check MUST use `grep -hoE` (not `-oE`). GNU grep prefixes matches with `filename:` when scanning >1 file, so `-oE` makes the `comm` diff report every stem as a false "missing." Several subagents self-corrected by re-running with `-h`; bake `-h` into the verify command.

**Coverage is the real safety net, not the subagent's self-report:** run `finalize` after each wave. It recomputes coverage from the concept pages directly; if a subagent silently dropped citations, the atoms surface as `UNCOVERED` and you know which wave to inspect. Across this run coverage held at 5877/5877 (0 uncovered) through every checkpoint.

**Keep base pages, dissolve only `-N` siblings.** The family base page (e.g. `review-pr-practices.md`) is the link anchor other concept pages point to; keep it and rewrite only the numbered siblings into named pages. Then sweep for concept→concept links to the deleted `-N` pages and repoint them (finalize's DANGLING count, minus the permanent builder-boilerplate `concepts/x.md`, tells you how many remain). Consequence to expect: `bytes_per_atom` ticks up slightly (~1%/run) because splitting N oversized pages into more smaller named pages multiplies per-page TL;DR+footer overhead — that is the endorsed "growth in page COUNT" and is NOT inventorying as long as coverage shows each atom cited exactly once.
