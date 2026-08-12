# Correcting posture is the highest-risk posture — audit with more rigour than the original claim

Three failures in one day, two agents, same root shape: **confident wrong artifacts were generated while in correcting posture.** Naming the condition is worth more than the individual rules.

## The condition

**A cheap single check feels sufficient precisely when you are auditing someone else's figure rather than producing your own.** Producing a number invites care. *Checking* one feels like it needs only a spot-check — and then the corrector's number inherits the credibility of the correction and travels with extra authority.

So: **verification performed in order to correct someone requires more rigour than the original claim, not less.**

## The three instances

1. **The wrong "correction."** Agent A reported 76 non-draft open PRs. Agent B "verified" with a single `?per_page=100` call, filtered to non-draft, got **54**, and passed that to both A and the operator as ground truth. Truth was 76 (page 1 = 55 non-draft of 100 *raw*, page 2 = 20, page 3 = 1). The filtered subtotal being under 100 made it look uncapped; the raw page length of exactly 100 was the real tell. A had paginated; B had not. **Both agents had already written up this exact truncation failure mode hours earlier.** Knowing it didn't prevent it — only running the method does.

2. **"I'll go fix that upstream" is itself a claim to check.** B promised to extend an already-published upstream comment with an additional code site. On re-reading what was actually posted, the edit wasn't warranted: the comment already reached the right conclusion ("one root cause, two code paths, two fixes"), and the extra site changed neither the count, the ask, nor the fix shape. Editing a maintainer's PR to add a corroborating detail is **net-negative** — it invites a re-read of something the author may have already processed, for no change in what's being asked. **Diff what is *published* against what you believe needs saying, before the write.** An intention to fix something outward-facing is a hypothesis about the current artifact, not a task to execute.

3. **A stale presupposition inside a live human escalation.** B had already confirmed no draft PR existed, then escalated to a human asking whether to "promote the draft out of draft" — presupposing the very thing its own finding disproved. Every underlying fact was right; the phrasing outran the evidence. Severity asymmetry: a stale fact in a log is recoverable, but **a bad presupposition sitting in a human's decision queue is not, because they may act on it.**

## How to apply

- Before correcting a figure, run the *full* method, not a spot-check — the exhaustive pagination, the exhaustive query. Cheapness is the smell.
- Before an outward-facing "fix," **read the current artifact** and diff it against what you think is missing. If the delta doesn't change the conclusion, the ask, or the required action, **don't write.** Silence is the correct output surprisingly often.
- When escalating a decision, re-read the question against the state you just verified and confirm its presupposition still holds *now*.
- Respect closest-to-the-state: if another party authored the artifact, the correction footprint is theirs, not yours.
- Related trap family — a degraded transport or partial fetch yields a well-formed, plausible, empty-or-short answer that reads as clean: unreconciled pagination, GraphQL-backed calls during a GraphQL 401 (`gh pr checks` phantom-green), and a GraphQL-derived `evicted: []` during that same outage. Design checks so truncation or outage **cannot masquerade as a clean result**.
