---
title: "[approver/challenger-miss] Devin 'Loading diffs…' banner means an incomplete capture — its findings are low-confidence"
type: learning
topic: review-approval
source: learnings/1788777703213-approver-challenger-miss-devin-loading-diffs-banne.md
---

# [approver/challenger-miss] Devin 'Loading diffs…' banner means an incomplete capture — its findings are low-confidence

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788776931144-xkbtcg
written_at: 2026-09-07T10:41:43.213Z
---

# [approver/challenger-miss] Devin 'Loading diffs…' banner means an incomplete capture — its findings are low-confidence

## Symptom
On the Devin-only synthesis tier (harvest exit 10/20/22), Devin's `devin-flags.md`
returned a plausible-looking findings list — 4 "Bugs" plus flags — for a large
docs PR (shader-slang/slang#12039, `expressions-conversions.md`, +454 lines).
Under the conservative fallback mapping, any Devin "Bug" maps to REQUEST_CHANGES,
which on a fork-clean / policy-clean PR would drive a BLOCK/REQUEST_CHANGES.

## Root cause
Devin captured the GitHub PR page **before the diff finished rendering**. Two
independent tells:
1. Devin's own output embedded the banner `Loading diffs…` / `This may take a few
   moments for large PRs` immediately above the findings.
2. Every finding clustered in lines **:6–:88** and Devin reported the sections at
   **:84-88 as "empty stubs"** — yet the (independent) stale `github-actions[bot]`
   review cited populated content at :156/:183/:292/:326/:393/:426/:454 and
   CodeRabbit's walkthrough confirmed full implicit-conversion and bit_cast
   sections. Devin only "saw" the top of the file; the not-yet-loaded lower diff
   read as empty. Its line-referenced findings were therefore artifacts, not real
   defects.

## How to catch it
When synthesizing from a Devin-only tier, scan `devin-flags.md` for the
`Loading diffs…` / `This may take a few moments` banner and for a findings
distribution that (a) clusters only near the top of a large file and/or (b)
claims sections are "empty stubs" that other harvested reviews describe as
populated. Cross-check Devin's max line-reference against the file's real length
(or another reviewer's cited lines). A large gap ⇒ partial render.

## Fix
Treat such Devin findings as LOW-CONFIDENCE and say so explicitly in the review
doc's reliability caveat (I did, in `review-doc.md`). Do NOT let a partial-render
"Bug" round a policy-clean PR toward BLOCK — the fallback verdict is already the
conservative (non-approving) direction, so this only matters when clauses pass:
in that case the challenger must verify each Devin line-reference against the
actual head diff (`gh pr diff`) before charging it, and where it can't verify,
ABSTAIN (uncertainty ⇒ ABSTAIN) rather than BLOCK on an unverified finding.
(For #12039 it was moot: Step-1 abstained on head_provenance + tier_eligible, so
Devin never reached the verdict — but the trap is real for the next Devin-only,
policy-clean PR.)

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788777703213-approver-challenger-miss-devin-loading-diffs-banne.md`_
