---
title: "When you concede an open question in a report, grep the SOURCE for comments asserting the resolved version"
type: learning
topic: misc
source: learnings/1786031904395-when-you-concede-an-open-question-in-a-report-grep.md
---

# When you concede an open question in a report, grep the SOURCE for comments asserting the resolved version

A critique pass on slang#12155 (2026-08-06) found its highest-value defect **not in the deliverable
under review, but in the source comments the deliverable described** — and the two contradicted each
other, same author, same hour.

**The shape.** My review-request message conceded, explicitly and at length, that a bounds guard's
semantic correctness was unresolved: *"all I actually demonstrated is that skipping avoids an
out-of-bounds read; whether the producer should be fixed instead is open."* Meanwhile the comment sitting
**at that guard** read *"...it correctly gets no varying attribute"*, and the comment at the related
assert said such fields are *"intentionally outside the result varying signature."* The prose was honest;
the code documented the question as settled design.

Nobody reading only the code would have known it was contested. Nobody reading only the message would
have known the code overclaimed. The reviewer would have hit the confident comment first and had no
reason to push on it — the concession would have been invisible at the point of use.

**Why it happens.** The comment is written during implementation, when you believe the shape is
understood. The concession is written later, during reporting, when you've been forced to distinguish
what you demonstrated from what you assumed. The report gets the benefit of that later, more careful
pass; the comment never gets revisited because *it isn't part of the diff you're re-reading* — it's
already committed, and it reads fine in isolation.

**The check, cheap and mechanical.** Whenever a report/PR body/review message says any of "unresolved",
"open question", "not verified", "no committed coverage", "I only demonstrated X" — grep the source for
comments near the cited lines and ask whether any of them assert the *resolved* version. Specifically
hunt for confident normative words in comments: "correctly", "intentionally", "by design", "always",
"never", "must", "safe to". Each is a claim; check each against what you actually proved.

**Rule:** a concession that doesn't reach the code isn't a concession. Ship the honesty to the artifact
a future reader will actually open — and the future reader opens the source, not your report.

Related traps from the same review, both worth their own check:
- **Don't assume a helper is single-purpose because you reached it from one path.** My comment described
  a layout as covering "the entry point's result"; `ensureStructHasUserSemantic` is a template
  instantiated for *both* `VaryingInput` and `VaryingOutput`. `grep` the callers before writing
  direction-specific prose in a shared function.
- **A cited test can fail to exercise the thing it's cited for.** I cited a test as proving the guard;
  its out param was *semanticed*, so it exited at an earlier branch and never reached the guarded lookup.
  It proved a weaker adjacent invariant. Trace the cited test to the specific line, don't infer from its
  name or its topic.
- **Carrying test results forward across a no-op delta is legitimate; labelling them as run at the new
  head is not.** Say "run at X, carried forward to Y because the delta is comment-only" — and the same
  for CI runs, which are attached to the head that was dispatched, not the head that is current.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786031904395-when-you-concede-an-open-question-in-a-report-grep.md`_
