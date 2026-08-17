---
title: "learnings-wiki footer counts drift chronically — the generator should recompute N, and duplicate citation rows hide inside it"
type: learning
topic: ci-tooling
source: learnings/1785825237204-learnings-wiki-footer-counts-drift-chronically-the.md
---

# learnings-wiki footer counts drift chronically — the generator should recompute N, and duplicate citation rows hide inside it

During the 2026-08-04 daily fold I audited every `wiki/concepts/*.md` footer instead of only the pages that day's agents touched. Two defect classes, both chronic and both invisible to per-page self-reports.

**1. Stated N drifts from the actual list — 19 of 47 pages.** Each fold agent is told to "append your lines and bump N", so N is maintained by incrementing. Increments accumulate error. Measured drift included pages with **no edits that day**: `review-pr-practices` 273→274, `slang-backends-spirv` 162→160, `slang-misc-build-infrastructure-and-tooling` 60→55, `slang-autodiff-ir-autodiff-differentiation` 40→37. So the drift predates any single run.

**2. Duplicate citation rows — 8 rows across 5 pages.** The same learning cited twice in one footer with *differently-worded* descriptions, e.g. on `slang-backends-spirv.md`:
```
- [Signature-derived SPIR-V VariablePointers must gate on [noinline], not hasUses()](…1781023718622-…)
- [Signature-derived SPIR-V VariablePointers must gate on [noinline], not hasUses() (#9061)](…1781023718622-…)
```
Near-identical, so they read as two distinct sources at a glance and inflate the apparent coverage. Dedupe by keeping the **more informative** row (the one carrying the issue/PR number) rather than the first — a blind "keep first" silently discards the better description.

**Why per-agent verification cannot catch either.** Each agent validated only its own slice and reported "footer counts match." All were locally truthful; the cross-cutting facts (drift on untouched pages, duplicates from *earlier* folds) were visible only to a global recount. **N independent self-reports do not compose into a coverage claim.**

**The counter itself is a trap.** My first row-counter was:
```bash
awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{c++} flag&&!/^- \[/&&NF{exit} END{print c+0}'
```
The `!/^- \[/&&NF{exit}` clause exits on the first line of intervening **PROSE** — not on blanks, which the `NF` guard already excludes (measured: `rows/blank/rows` → correct; `rows/blank/prose/blank/rows` → 2 of 4) — but real footers carry prose between row groups — so it counted a prefix and **manufactured mismatches on correct pages**. It produced exactly the finding I expected, which is why it was tempting. Sound version, with a built-in control:
```bash
rows=$(awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{c++} END{print c+0}' "$f")
uniq=$(awk '/^\*\*Source learnings \(/{flag=1;next} flag&&/^- \[/{print}' "$f" \
        | grep -oP 'wiki/learnings/\K[^)]+' | sort -u | wc -l)
```
`rows == uniq` is self-validating: divergence means either a parse failure or a duplicate, so the instrument announces its own trouble instead of reporting it as content.

**Fix to make, so this stops recurring:** have `finalize()` in `.learnings_wiki.py` recompute `**Source learnings (N):**` and frontmatter `source_count` from the deduped stem set on every run, and drop duplicate rows (keeping the longest description). Then no agent instruction needs to mention N at all — the number becomes derived data rather than maintained data. Until that lands, the daily fold must include a global recount pass; instructing agents to "bump N" will keep producing drift.

**Generalizes:** any "N:" adjacent to an enumeration is derived data. Never trust it, never increment it, always recompute it — and never trust a writer's report about arithmetic it performed on its own work.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785825237204-learnings-wiki-footer-counts-drift-chronically-the.md`_
