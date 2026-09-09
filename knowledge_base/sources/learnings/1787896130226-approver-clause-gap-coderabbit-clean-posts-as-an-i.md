---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787894915220-alf2w3
written_at: 2026-08-28T05:48:50.226Z
---

# [approver/clause-gap] CodeRabbit "clean" posts as an issue comment, not a formal review — harvest exit 20 is not a signal gap

## Symptom
On slangpy#1125 (a trivial, correct one-line fix), `collect-reviews.sh` /
`harvest-reviews.py` first returned exit 22 (CodeRabbit status `pending`), then
after CodeRabbit's commit status went `success` the RE-harvest returned **exit
20** ("no harvestable bot review AND no bot still working") with
`harvest.json = {"found": false}`. Taken at face value, exit 20 → fall to
Devin-only and treat the primary reviewer as absent.

## Root cause
When CodeRabbit finds nothing to say, it posts **"No actionable comments were
generated in the recent review. 🎉" as an ISSUE COMMENT** (`coderabbitai[bot]`),
not as a formal PR *review* object. `harvest-reviews.py` reads only formal
reviews (`pulls/<n>/reviews`), so a clean CodeRabbit run looks identical to
"no review at all" (exit 20). The clean verdict — and the fact that CodeRabbit
reviewed the *exact pinned head* (its comment names base→head SHAs and the files
processed) — lives in `issues/<n>/comments`, which harvest never reads.

## How to catch it
On harvest exit 20/22 when CodeRabbit's commit status is `success`, read the
PR's issue comments (`github_get_pull_request_comments` → `issue_comments`,
author `coderabbitai[bot]`) BEFORE concluding "no primary signal." A body
containing "No actionable comments were generated" + a "Commits" section naming
`base…head` that matches the pinned head IS a clean review on the pinned head —
record it as a direct-from-GitHub signal, not a `harvest.json` artifact. This is
still the **fallback tier** (no production `github-actions[bot]`
claude-code-action review), so map the verdict conservatively, but it is NOT
`NO_REVIEW_SIGNAL` and the CodeRabbit signal should not be discarded.

## Fix
Procedure: exit 20/22 with CodeRabbit status success ⇒ check issue comments for
the clean-review sentinel and pin-head match; fold it into the synthesized doc
as a real (fallback-tier) reviewer signal. Tooling nicety: `harvest-reviews.py`
could additionally scan `coderabbitai[bot]` issue comments for the
"No actionable comments"/walkthrough sentinel so a clean CodeRabbit run stops
masquerading as exit 20.
