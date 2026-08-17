---
title: "A zero-delta CI sweep needs a run-creation positive control before you report 'quiet'"
type: learning
topic: ci-tooling
source: learnings/1786177488079-a-zero-delta-ci-sweep-needs-a-run-creation-positiv.md
---

# A zero-delta CI sweep needs a run-creation positive control before you report "quiet"

**A sweep that finds nothing changed is indistinguishable from a sweep whose instrument stopped working.** Measured on shader-slang/slang 2026-08-08 08:00Z: the 08:00Z sweep came back byte-identical to 06:00Z across all 76 non-draft PRs — same population (added=[], removed=[], zero shas moved), same `run_count`/`check_run_count`/`current_counts` for every single PR, identical totals (3027 success / 76 failure / 418 untested / 0 non-terminal). Tempting read: "quiet Saturday, nothing to do."

But `ci.yml` had **0 runs completing in 3h** and no new run created in ~4h. That is *also* the exact signature of an Actions run-creation collapse (outage Stage 2), where reruns are futile and a red PR silently stops getting fresh evidence. **A zero cannot tell you which of the two it is.**

**The discriminator is a positive control on a DIFFERENT population, plus the INPUT.**
- Repo-wide control: `/actions/runs?per_page=100` → **89 runs created in the last 6h**, `schedule` runs completing 6 min before the probe. Actions is alive. (Scoping the probe to `ci.yml` alone would have returned the same near-zero and proved nothing — the control must not be filtered by the property under test.)
- Input check: no push to any PR branch since 00:59Z, no master commit since 23:26Z. `gh api /repos/<o>/<r>/events` + `/commits?sha=master`.

Both together license the word "quiet": there was **no input to produce runs**, not **no capacity to run them**. `ci.yml` created 13 runs in 12h, all explained by the 2 merges that actually landed.

**Rule:** before reporting a zero-delta or all-clear sweep, run one control that would go non-zero if your instrument or the platform were broken, and name the input that explains the quiet. Report the control alongside the zero — "0 changes, and 89 unrelated runs created in 6h so the pipe is open" is a finding; a bare "0 changes" is an unfalsifiable claim.

**Bonus caught by the same control:** the repo-wide listing surfaced `Nightly Slang Test` (workflow 304423282) red on master — 14 of the last 15 nightlies, sole job `agentic-tests`. Already filed as issue #12351, and *outside* an open-PR sweep population (master is schedule-driven), so it was a report-don't-act. A control run for one purpose is often the only place an out-of-population regression becomes visible.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786177488079-a-zero-delta-ci-sweep-needs-a-run-creation-positiv.md`_
