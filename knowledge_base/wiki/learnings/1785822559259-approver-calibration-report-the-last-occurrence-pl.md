---
title: "[approver/calibration] Report the LAST occurrence plus the clean run after it — and a silence in commentary is not a silence in the phenomenon"
type: learning
topic: review-approval
source: learnings/1785822559259-approver-calibration-report-the-last-occurrence-pl.md
---

# [approver/calibration] Report the LAST occurrence plus the clean run after it — and a silence in commentary is not a silence in the phenomenon

Two related reporting defects, both caught by applying a provenance check to a **claim** rather than a citation. Neither is about a wrong number — in both cases the instrument was fine and the *framing* or the *referent* was wrong.

## 1. A date range without a denominator hides whether a problem is live or historical

A peer told an operator a defect was "a month-old known annoyance," derived from 11 log files spanning 06-24 → 07-19. The provenance held: 11 files, all parseable, the instrument measured what was claimed. **But they reported the FIRST occurrence.** Mentions stopped at 07-19 and **557 later log files contained zero mentions** — a real denominator, so the silence carried information.

*"First seen 06-24"* and *"last seen 07-19, then 557 clean files"* support **opposite decisions**. The first framing argues "long-standing, low-severity, deprioritize"; the second argues "went quiet 16 days ago — did something change?" Same data, and the published framing pointed at the wrong action.

**Rule: report the LAST occurrence plus the size of the clean run after it. The start date is trivia.** A range with no denominator is unfalsifiable in the direction that matters — you cannot tell an active problem from a resolved one.

## 2. ⭐⭐ A silence in COMMENTARY is not a silence in the PHENOMENON

The 557 clean files then tempted the same peer toward "probably resolved" — while they were holding a **fresh instance from that morning**, with the causing race still unchanged in source. **Log mentions measure who complained, not what occurred.** Absence of complaint is absence of *reporting*, and reporting depends on who was looking, whether anyone was inconvenienced enough to write it down, and whether the observer even recognized it.

This is the same category error as a token probe that reads a proxy's rule table rather than the upstream service's view of the credential: **the instrument works, the referent is wrong.** Before reading a silence as evidence, name what the source actually records, then ask whether the thing you care about would necessarily appear in it. If the answer is "only if someone chose to write about it," the silence is worth close to nothing.

## 3. The instance this found in my own store: a present-tense claim that aged into a false one

Applying the same lens to my own held decision row, I found: *"CI still mid-flight — 2 Windows legs in_progress — so the head isn't fully settled."* True when written (a 08-03T17:20Z reading), stated in the **present tense** in a durable artifact. Re-probing 18 hours later: **20 success / 1 skipped / zero in_progress — CI had fully settled.** Anyone reading the row as current would have inherited a false premise about the chain's state.

**Rule: timestamp every observation, or re-probe it before relying on it.** A present-tense claim in a durable record silently ages into a false one, and unlike a wrong number nothing ever flags it — the text stays exactly as correct-looking as the day it was written. Corollary for held/blocked decisions specifically: a hold rests on *absence of new input*, which is precisely the claim most likely to have expired since you wrote it.

**Meta-observation:** the provenance rule was developed for published *line numbers*, and generalized without modification to a severity claim, a silence-as-evidence inference, and a stale status line. What all four share is that the check has to interrogate **how the claim was produced**, not whether it looks right — because all four looked right.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785822559259-approver-calibration-report-the-last-occurrence-pl.md`_
