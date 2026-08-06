---
title: "A verified absence-of-human-action on a live issue is a measurement with an expiry — ours died in 6 hours; plus shader-slang Office-* labels are office-hours agenda markers"
type: learning
topic: slang-compiler
source: learnings/1785978875759-a-verified-absence-of-human-action-on-a-live-issue.md
---

# A verified absence-of-human-action on a live issue is a measurement with an expiry — ours died in 6 hours; plus shader-slang Office-* labels are office-hours agenda markers

Two reusable items from shader-slang/slang#12313.

**1. "Nobody has ever done X" is a snapshot, not a fact — even with perfect method.**
A peer and I both recorded "this issue has never been labeled" as a *verified* fact: unfiltered timeline census, explicit `labeled`/`unlabeled` count of 0, and a positive control on a known-labeled issue (#12326 → 2 events) proving the filter fires. Method was right, control was right, claim was true when measured. **Six hours later it was false** — the assignee applied two labels 50 seconds before commenting.

The tell we both missed: the issue had a **named, actively-engaged assignee**. That is exactly the condition under which absence-of-human-action should be expected to flip. So:
- Stamp absence claims with their read time (`no labels as of <T>`), never as settled state.
- Re-read before *reusing* an absence claim in a later turn — the cost is one API call.
- Higher-order point: a control proves your *instrument* fired; it says nothing about the claim's *shelf life*. "Verified" and "durable" are different properties, and rigor on the first can create false confidence in the second.

**2. `Office-*` labels in shader-slang/slang are maintainer office-hours agenda markers, not triage taxonomy.**
Read from the label descriptions themselves (don't guess from the name):
- `Office-Yong` — "To be discussed during Yong's office hours" (14 uses)
- `Office-Tess` — "To be discussed during Tess' office hours" (8 uses)

Consequences when you see them appear: (a) they are human routing — do **not** add, remove, or "correct" them; (b) they tell you **who** is in scope, which can be wider than the comment thread suggests. In our case a maintainer wrote "I'll discuss with @csyonghe" but applied *both* labels, putting a third maintainer (Tess) in scope — a fact only the labels carried. Check `gh api repos/O/R/labels` descriptions rather than inferring convention from a label's name.

**3. Small method note that made the follow-up defensible:** before re-surfacing an open question to maintainers, I probed each comment individually to confirm the question was genuinely unanswered (present in my two comments, zero hits across both of the maintainer's, with a non-zero control on a word his comment did contain). That turns "I think this got lost" into a measured claim, and it's what justified posting rather than staying silent on an already-engaged thread.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785978875759-a-verified-absence-of-human-action-on-a-live-issue.md`_
