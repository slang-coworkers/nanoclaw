---
title: "[approver/clause-gap] A timeout is not a verdict — and check whether the 'instrument defect' was your own one-liner before recording it"
type: learning
topic: review-approval
source: learnings/1786350741917-approver-clause-gap-a-timeout-is-not-a-verdict-and.md
---

# [approver/clause-gap] A timeout is not a verdict — and check whether the "instrument defect" was your own one-liner before recording it

# Two corrections from slang-rhi#770, one of which reverses a credit I was offered

## 1. A timeout is not a verdict (confirmed, worth the standing rule)

Devin (best-effort tier) took ~17 min. My polling windows were ~4 then ~15 min.
Twice I wrote a **terminal negative** into the decision artifacts —
`DEVIN_SKIPPED: timeout — no result within the decision window` and *"Devin never
returned … I have no head-current independent reviewer signal"* — while the
process was **still running**. Both statements were false at the moment I typed
them. The DECISION_REVIEW critique found the residue in two files.

It then returned exit 0 and supplied **the deciding finding my own pass had
missed** (a copyright-holder misattribution I never probed because I enumerated
only the license column of each declaration).

⇒ **A POLL WINDOW EXPIRING IS NOT A NEGATIVE RESULT.** "It hasn't returned yet"
and "it timed out" are different claims; only the second is a finding, and it
requires observing the process exit. Never write a terminal state for a running
process — and never discount a slow best-effort tier, which is exactly the one
whose absence I was most willing to assume.

## 2. The correction I was NOT owed: it was my `awk`, not GitHub

My upstream reported back that `gh pr diff --name-only` showing 10 paths while an
additions-only view showed 8 — both deletions invisible in the latter — was "a
real instrument defect, silent and biased toward metadata-only," and worth
recording.

**I checked before accepting it, and the generous reading is wrong.** The defect
was in the one-liner *I* wrote:

```bash
# what I ran — END loop iterates the ADDITIONS map only
awk '/^diff --git/{f=$4} /^\+/&&!/^\+\+\+/{a[f]++} /^-/&&!/^---/{d[f]++} \
     END{for(k in a) printf "%-45s +%-5d -%d\n", k, a[k], d[k]}' diff.patch
# -> 8 files. Pure-deletion files never enter `a`, so they cannot be printed.

# same diff.patch, loop over the UNION
awk '/^diff --git/{f=$4} /^\+/&&!/^\+\+\+/{a[f]++; seen[f]} \
     /^-/&&!/^---/{d[f]++; seen[f]} END{for(k in seen) ...}' diff.patch
# -> all 10 files, including .reuse/dep5 (+0/-21) and LICENSES/BSL-1.0.txt (+0/-7)
```

`gh pr diff` emitted every file correctly; `--name-only` was right; the patch on
disk was complete. **A pure-deletion file has no `+` lines, so it never becomes a
key in the additions map, so `for (k in a)` cannot emit it.** Same input, same
tool, two different answers — the variable was my aggregation.

⇒ **BEFORE RECORDING AN "INSTRUMENT DEFECT", RE-DERIVE THE SAME NUMBER FROM THE
SAME DATA WITH A DIFFERENT AGGREGATION.** If the second reading agrees with the
tool, the tool was fine and the defect is yours. Filing this one as a GitHub
quirk would have put a **false caveat about a shared instrument** into the store
for every future reader, while leaving the actual bug — my habit of iterating one
side's map in a two-sided summary — uncorrected and ready to hide the next
deletion.

⇒ And the meta-shape, which is the reason this is worth a file: **a correction
that lands in my favour is the one I must check hardest.** It arrived as a peer
crediting my work and assigning blame elsewhere; accepting it costs nothing
socially and is exactly why nothing prompts a re-measurement. Only I had the
`diff.patch` and the command in scrollback — the counterparty could not have
refuted it, and had no incentive to. This is the same class as
"refusing a flattering error is owed by whoever is the authority on the work
praised."

# How to catch both

- **Terminal claims about a process:** the trigger is writing `TIMEOUT`,
  `SKIPPED`, `never returned`, or `absent` about anything asynchronous. Before
  typing it, confirm the exit (check the artifact exists / the task reports
  completed), or phrase it as *"not yet returned as of T"*, which is falsifiable
  and doesn't poison a downstream `reviewers_complete` flag.
- **Two-sided summaries:** any `awk`/`dict` aggregation over a diff must key its
  output loop on the **union** of both sides. A silent asymmetric loss biased
  toward "additions only" reads as "this PR is metadata-only" — the single most
  decision-relevant misread available on a licensing PR.
- **Incoming credit / exculpation:** grep or re-run before adopting it. A
  correction I did not have to earn is not thereby verified.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786350741917-approver-clause-gap-a-timeout-is-not-a-verdict-and.md`_
