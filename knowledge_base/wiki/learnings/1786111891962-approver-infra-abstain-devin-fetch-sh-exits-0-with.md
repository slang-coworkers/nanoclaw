---
title: "[approver/infra-abstain] devin-fetch.sh exits 0 with an EMPTY Flags section — byte-count integrity guard is not a content guard"
type: learning
topic: review-approval
source: learnings/1786111891962-approver-infra-abstain-devin-fetch-sh-exits-0-with.md
---

# [approver/infra-abstain] devin-fetch.sh exits 0 with an EMPTY Flags section — byte-count integrity guard is not a content guard

## Symptom

On shader-slang/slangpy#1094, `devin-fetch.sh --url ... --out <ws>/review` **exited 0**
and wrote a `devin-flags.md` whose `## AI Analysis` section was a raw diff dump and
whose `## Flags` section was **empty**. Taken at face value, the PR looked
Devin-clean with zero findings. Re-opening the page and expanding the results panel
showed the truth: **0 Bugs, 1 Flag** — and the flag ("corrupt caches are now never
repaired") was directly material to the decision.

Exit 0 + a plausible-looking file is the worst failure shape available: it is
indistinguishable from a clean review, and nothing downstream flags it.

## Root cause

Two independent weaknesses in the runner
(`/home/node/.claude/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh`, ~lines 86-220):

1. The done-poll condition (`heading && summary`) can be satisfied while the
   flags panel is **still unrendered**. The page showed `No description` +
   `Analysis complete / View results` — enough to satisfy the poll, not enough
   to have results in the DOM.
2. The body-integrity guard checks only **total byte count** (~200 bytes). A raw
   diff dump is many KB, so the guard passes with flying colors on an extract
   that contains no findings at all.

The guard measures the wrong property. Size is a proxy for "we scraped
something"; it says nothing about "we scraped the thing we came for."

## How to catch it

- Assert on the **presence of a findings summary**, not on byte count: a
  successful Devin extract must contain a flags/bugs tally (`N Bugs`, `N Flag(s)`,
  or an explicit `No flags`). An extract with neither is an unrendered page, not a
  clean review — treat it as the exit-2/3/4 skip path.
- Generalize: **absence of findings in a scraped artifact is never evidence of
  absence of findings.** A scraper's silence and a reviewer's clean bill are the
  same bytes. Any harvest/scrape whose "clean" output is byte-identical to its
  "failed to load" output needs a positive marker before you may read it as clean.
- When a subagent runs the scrape, have it verify the panel rendered before
  returning — and have it report the re-extraction, so the artifact-integrity
  note lands in the decision row rather than being silently smoothed over.

## Fix

For this decision: re-extracted `devin-flags.md` from the rendered panel and
recorded an `artifact_integrity_note` in the decision's challenger field, so the
ledger row carries the provenance of the finding.

Durable fix (runner-side, not yet applied): add a content assertion to
`devin-fetch.sh` — require a flags-summary regex in the extract before exit 0,
and fail to the skip path otherwise. Until that lands, any `DEVIN` artifact
reporting zero findings should be spot-checked against the rendered panel before
it is allowed to contribute a clean signal to a decision.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786111891962-approver-infra-abstain-devin-fetch-sh-exits-0-with.md`_
