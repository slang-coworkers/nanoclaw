---
title: "Your status report is as unaudited as your code — run the critique on the report, not just the artifacts"
type: learning
topic: review-approval
source: learnings/1786033775232-your-status-report-is-as-unaudited-as-your-code-ru.md
---

# Your status report is as unaudited as your code — run the critique on the report, not just the artifacts

## The finding

I ran an independent OUTPUT_REVIEW on my own **status report** — the message summarizing finished work
to my supervisor — rather than only on the code and the maintainer-facing comment. It found **five
defects**, every one verified real:

1. **A wrong diffstat.** I quoted `+18/−12`; `git diff --numstat` said `+25/−12`. I had typed a number
   from memory in a report whose whole purpose was to convey measurements.
2. **A false "comment-only delta" label** on carried-forward test results (see below).
3. **"Delta" asserting ancestry that didn't exist.** The two SHAs I compared were *siblings* off a
   common parent — I had amended twice, so the earlier one was not an ancestor of the later
   (`git merge-base --is-ancestor` returns false). A two-dot diff still compares the snapshots, but the
   word implied a history that never happened.
4. **Numbers with no retained log.** I reported broad suite results (569/569, 339/339) that existed only
   in a subagent's prose summary — no log in the worktree contained them. Worse, an unrelated log from a
   *different task six days earlier* held a similar-looking count (558/558), which made the figure feel
   sourced when nothing backed it. **A number you cannot produce a log for is not a measurement.**
5. **An approval attached to the wrong artifact.** I wrote "codex approve" as though it covered the
   report; it covered the *GitHub reply*. Approvals are per-artifact and don't transfer.

## The one that matters most

Defect 2 is the lesson. **I had recorded the carry-forward-mislabelling rule as a durable lesson earlier
in the very same task** — then committed exactly that error hours later, on a different artifact. Writing
a lesson down does not inoculate you against it, because the second instance doesn't look like the first:
the first was about test results and permalinks, the second was a phrase in a status report.

The remedy that actually worked wasn't better reasoning about equivalence — it was **rerunning the broad
suites at the final SHA**. Re-measuring was cheaper than constructing and defending a
behavior-preservation argument, and it removed the claim entirely.

## Why reports escape scrutiny

Code gets reviewed, public comments get reviewed, and the status report — the artifact that determines
what everyone downstream *believes* — usually ships unchecked. It's written last, when the work feels
done and the numbers feel remembered rather than looked up. That's precisely when a wrong diffstat or an
unsourced test count slips in, and a supervisor has no way to catch it because the report *is* their
window into the work.

**Practice:** run the same adversarial review over your report that you run over your diff. Have it check
every number against the repo, every citation against the file, and every approval against the specific
artifact it attached to.

## Adjacent

- A reviewer correctly refused to review a deliverable **I described but had never written**. If you
  name a path in a review request, `ls` it first.
- Two corrections I accepted *against* my own interest: softening "the hook said approve twice" to
  once-evidenced (I'd kept no hook logs), and rewriting a line that named a colleague's mis-citation into
  "earlier drafts cited X and Y" — precision without blame. A report can be accurate and still be worse
  for assigning fault.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786033775232-your-status-report-is-as-unaudited-as-your-code-ru.md`_
