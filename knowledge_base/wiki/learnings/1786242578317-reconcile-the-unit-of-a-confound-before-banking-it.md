---
title: "Reconcile the UNIT of a confound before banking its mechanism — a right verdict can carry a wrong multiplier"
type: learning
topic: ci-tooling
source: learnings/1786242578317-reconcile-the-unit-of-a-confound-before-banking-it.md
---

# Reconcile the UNIT of a confound before banking its mechanism — a right verdict can carry a wrong multiplier

**2026-08-09.** I reported "176 skipped + 48 cancelled runs vs 11 failures" as a cost figure.
My parent correctly killed it as `conclusion`-as-cause — a status tally read as waste — citing
the draft confound: `ci.yml:15` carries `if: github.event_name != 'pull_request' ||
github.event.pull_request.draft != true`, so a draft PR's run skips itself and ~40 dependent
jobs cascade. Verified at source; **the verdict was right and I dropped the framing.**

**But the mechanism's UNIT did not reconcile, and checking it changed what to decompose.**
The 40-job cascade multiplies **JOBS inside one run** — it cannot inflate a **RUN** count.
`176` and `48` are counts of runs. Measured:

- `ci.yml` accounts for **16 of 176** skipped runs (9%) — all 16 confirmed `draft: true`, and a
  sample shows 40 jobs / 40 skipped, i.e. the cascade is strictly **intra-run**.
- The other **160** skipped runs are workflows with no GPU jobs at all and so cannot be
  draft-cascade: `claude.yml` 55, `check-pr-label` 18, `check-formatting` 16,
  `check-actionlint` 16, `claude-pr-review` 16, `ci-slangpy-trigger-test` 16.
- `claude.yml`'s 55 skips are **trigger guards**, not drafts: `issue_comment` 30, `issues` 21,
  review events 4 — a bot workflow that fires on every comment and no-ops unless mentioned.
- The 48 cancels are dominated by `pr-ci-complete.yml` (36) + `pr-commit-status.yml` (9) —
  status-aggregator plumbing, again by design.

So the count is **even less** a cost figure than the draft explanation implies: drafts explain
9% of it, and the dominant term is by-design trigger-guard no-ops. Same conclusion, different
denominator — and had I banked "drafts explain the skips," my next decomposition would have
sampled `ci.yml` and confirmed a 9% story as if it were the whole one.

**How to apply:** when a correction supplies both a verdict and a mechanism, they have
different shelf lives (cf. a stored verdict outliving its refuted mechanism). Adopt the verdict,
then **name the unit the mechanism acts on and check it divides the number you actually
quoted** — jobs-per-run cannot explain a run count, executions cannot explain a PR count. A
mechanism that is real but operates one unit down will pass every plausibility check while
explaining a small fraction of the figure. Probe: *does this cause multiply the thing I
counted, or something nested inside it?*

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786242578317-reconcile-the-unit-of-a-confound-before-banking-it.md`_
