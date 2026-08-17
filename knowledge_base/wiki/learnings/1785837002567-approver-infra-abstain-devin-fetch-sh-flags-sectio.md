---
title: "[approver/infra-abstain] devin-fetch.sh Flags section can be EMPTY while Devin actually found flags — read devin-page.txt, never trust devin-flags.md alone"
type: learning
topic: review-approval
source: learnings/1785837002567-approver-infra-abstain-devin-fetch-sh-flags-sectio.md
---

# [approver/infra-abstain] devin-fetch.sh Flags section can be EMPTY while Devin actually found flags — read devin-page.txt, never trust devin-flags.md alone

## Symptom

On shader-slang/slang#12246 (Devin-only tier, harvest exit 20), `devin-fetch.sh`
exited **0** and wrote `review/devin-flags.md` — 5,065 bytes, 9 lines, whose
`## Flags` section was **completely empty** (0 occurrences of 🔴, no
bug/blocking/critical lines). The file's bulk was Devin's *rendering of the PR
description*, not findings.

Devin had in fact reported findings. From `review/devin-page.txt` — the page
dump from the **same fetch, same run**:

```
0 Bugs
1 Flag
Mark all as read
Switch inside a generic body over a value of a bare generic type parameter would now be rejected
Investigate
slang-check-stmt.cpp:410-417
Early return skips checking the switch body (case labels / declarations inside)
Informational
slang-check-stmt.cpp:416-419
```

The flag was substantive — a potential **over-rejection** in a `pr: breaking
change` semantic-checker narrowing. Synthesizing the review doc from
`devin-flags.md` alone would have recorded "Devin completed, 0 findings" and
carried a false-clean prior into the challenger.

## Root cause

An **extraction gap in `devin-fetch.sh`**, not an absence of findings and not a
fetch failure. The script's flag-scraping selector under-reads the findings
panel (Devin's "N Bugs / N Flags" side panel), while the exit code (0) and the
screenshot/page dump all indicate a fully successful fetch. Exit 0 + a
non-trivially-sized flags file looks exactly like "completed clean."

## Why this is dangerous specifically for the approver

This is a **silent false-negative with no failure signature** — the class my
store already flags as the worst kind. Every other signal says success:
`devin.exit` = 0, `devin-run.log` shows the screenshot saved and the flags file
written with a plausible line count, and on the Devin-only tier (bot-authored
`fix/issue-N` branches, where production `claude-pr-review.yml` skips the
review) Devin is the **sole** review signal. A zero-findings read there feeds
straight into `bugs: 0, gaps: 0` and a clean challenger prior.

## How to catch it

- **Always read `review/devin-page.txt`, not just `devin-flags.md`.** Grep the
  page dump for the findings panel:
  `grep -nE "Bugs|Flag|Investigate|Informational" review/devin-page.txt`
  The panel reports explicit counts (`0 Bugs`, `1 Flag`) — use those as the
  authoritative tally.
- **An empty `## Flags` section is a must-verify, not a clean bill.** Treat
  "flags file exists, Flags section empty" as unproven-clean until the page dump
  corroborates it. Devin genuinely finding nothing and the extractor dropping
  everything produce identical `devin-flags.md` content.
- **Cross-check the count.** If the page dump says `N Flags` with N>0 and
  `devin-flags.md` lists none, the file is wrong — use the page dump and record
  the artifact defect in the review doc.

## Fix

Two layers:
1. **Procedure (do this now, no code change needed):** the synthesis step must
   source Devin findings from the page dump's findings panel, using
   `devin-flags.md` only as a convenience view. Record the discrepancy in the
   review doc when they disagree.
2. **Script (upstream):** `devin-fetch.sh` should parse the findings panel
   counts and **fail loudly** — or emit a `DEVIN_EXTRACTION_MISMATCH` marker —
   when the panel reports `N>0` flags but the extractor produced zero lines.
   A silent 0-for-N extraction is worse than a non-zero exit.

## Generalizable rule

**A "0 findings" result from a tool is only as trustworthy as the extractor
that produced it — and an extractor cannot report its own truncation.** Same
shape as the `WebFetch`-for-counts rule already in my store: when a summarizing
or scraping layer sits between you and a count, get the count from the source's
own tally, not from the derived artifact. And when a tool is the *sole* signal
for a decision (Devin-only tier), that cross-check is mandatory, not optional.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785837002567-approver-infra-abstain-devin-fetch-sh-flags-sectio.md`_
