# [approver/clause-gap] An empty PR body on a fresh PR is a timing race, not maintainer silence — and not a staleness bug either

## Symptom

slangpy#1094: I recorded `ABSTAIN_POLICY:OPEN_GAP` at `14:10:15Z`, resting gap 2
on *"the PR has no description at all to say"* whether a deliberate tradeoff was
accepted. The human APPROVED at `15:09:20Z` and merged — a false negative.

The PR body was **empty when I decided** and populated later, and its fourth
bullet is my gap 2 almost verbatim: *"Remove deleting of the shader cache if it
fails to initialize as this was not save across processes"*. The question I
correctly called unanswerable **became answerable from the artifact**.

## Two plausible root causes, both refuted by timestamps

1. **"Staleness — re-read the body before finalizing."** REFUTED. Body populated
   `15:08:42Z` (GraphQL `userContentEdits`, editor `skallweitNV`); my decision was
   `14:10:15Z`. The body arrived **58 minutes after** I finalized. Re-reading
   before finalizing would have found the same empty body. No re-read discipline
   could have caught this.
2. **"Severity calibration — the bar was too high."** Incomplete, and it rests on
   a weak signal. The approving review has an **empty body**, landed **38s** after
   the description first existed, and the **author self-merged** 5 minutes later.
   Lowering my bar because *that* is the disagreeing verdict is fitting to noise.

## Actual root cause

The input was **not yet authored**, not absent. `diff: null` on the
creation-time `userContentEdits` node means empty-at-creation; on slangpy that is
**7 of 21** PRs with body edits (control-tested: #1035, #1063 empty-then-added;
#1090 non-null at creation, body present). Empty-at-creation is common and
resolves late.

So a decision hinging on an absent body is a **wait-for-settled-artifact** case —
structurally identical to the `/slangpy-pr-approve` `harvest-reviews.py` **exit 22
`pending_bot`** rule, which already says: a review that hasn't appeared yet is *a
timing race on a fresh PR, not a skip* → poll, then re-harvest. The PR body needs
the same treatment and has no such rule.

## How to catch it

Before letting "the PR doesn't say" carry a gap, ask whether the artifact is
*absent* or merely *not yet written*:

```
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  createdAt lastEditedAt
  userContentEdits(first:20){totalCount nodes{editedAt diff editor{login}}}}}}'
```

Empty body + PR age measured in minutes + `diff: null` at creation = not settled.
Note CodeRabbit's "Description check" re-renders stale (still said "no description
provided" 10s *after* the body landed) — don't read it as current state.

## Fix

- An **empty body on a young PR is an unsettled input**, not evidence of
  maintainer silence. If a gap's only support is "the PR has no description",
  that gap is not ripe: wait for the body (bounded, like `pending_bot`), or
  record the gap without leaning on absence-of-description as its support.
- **Never infer acceptance-unanswerable from an artifact that is still being
  authored.** Absence of a statement in a not-yet-written field carries zero bits
  — the negative-evidence probe applies to artifact *readiness*, not just to test
  outcomes.
- **Discount thin joins when calibrating.** An empty-body approval submitted
  seconds after the description appeared, followed by an author self-merge, is
  weak evidence about where the bar belongs. Record the mismatch; don't
  recalibrate severity on it.

Generalization: my standing challenger probe says a negative observation that
*could not have come out otherwise* carries zero bits. Same defect one level up —
I read an **unpopulated field** as a **substantive silence**.
