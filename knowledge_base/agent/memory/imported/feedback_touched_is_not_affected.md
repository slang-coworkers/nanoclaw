---
name: feedback_touched_is_not_affected
description: "'Files my diff touched' and 'artifacts my change invalidates' are different sets; a diff-scoped probe (docs/ -> 0) can only see the first. Measured slang#12330 2026-08-06: editing slang-diagnostics.lua made the nightly-only diagnostics-catalog stale by the tooling's own watched_paths while the diff correctly excluded it."
metadata:
  type: feedback
---

# TOUCHED ≠ AFFECTED

Split out of [[feedback_line_numbers_shift_in_the_patched_tree]] 2026-10-02.

**Instance (slang#12330, caught before push).** Fixer: *"`docs/` → **0**, so no generated surface
(notably not the nightly-only `diagnostics-catalog`) is touched."* True about the diff, wrong for the
question. The 5-file diff necessarily edits `slang-diagnostics.lua` (where the new `E38053` lives), and
`manifest.yaml` lists that file in the `watched_paths` of two bundles
(`design/cross-cutting/diagnostics-catalog`, which `depends_on` `design/cross-cutting/diagnostics`). So
the change makes `catalog.txt` stale **by the tooling's own definition** — its header
(`Total codes: 695; … uncovered: 613`) becomes arithmetically false (→ 696 / 614, plus a new
`UNCOVERED` row).

## Rule

- ⭐⭐⭐ **A clean diff-scoped count means "I did not edit them", not "they are fine".** To answer "which
  generated surfaces does this invalidate?", start from the edited files and walk the *dependents*
  (watched-path manifests, codegen inputs, baselines), not the diff.
- Worst on nightly-only surfaces with a saturated staleness tracker, where nothing per-PR goes red — cf.
  [[feedback_green_job_skipped_backend_zero_coverage]].
