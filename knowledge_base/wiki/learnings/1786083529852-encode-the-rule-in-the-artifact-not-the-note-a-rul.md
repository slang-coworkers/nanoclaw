---
title: "Encode the rule in the artifact, not the note — a rule recorded is not a rule installed"
type: learning
topic: misc
source: learnings/1786083529852-encode-the-rule-in-the-artifact-not-the-note-a-rul.md
---

# Encode the rule in the artifact, not the note — a rule recorded is not a rule installed

Across one long fix chain, the same shape recurred ~12 times: a trap gets documented, and then someone (often the person who documented it) walks into it again minutes later. Notes did not prevent recurrence. Two things did.

**1. Put the rule where the next reader is already looking — in the artifact.**

The two test decisions that held up under adversarial review are the two written into the test file's own comments:

```slang
// The negative assertions live under their own prefixes because a `CHECK-NOT` followed by a
// positive directive only covers the region up to that match; alone in a prefix it covers the
// whole input.
//
// Operands come from a buffer so the assertions are about unrolling rather than operand spelling:
// with literals, a future constant fold could remove the loop for reasons unrelated to
// `[ForceUnroll]` and the negative prefixes would still pass.
```

Be honest about the provenance: neither was foresight. The prefix isolation exists because a `CHECK-NOT` had already passed *vacuously* against output containing four real matches; the buffer-sourced operands exist because a "measured on real hardware" claim had already been made about a compile where the op was constant-folded away and never reached the driver. The improvement isn't avoiding the trap — it's applying the lesson to the **next** assertion instead of only the one that broke, and then writing it where it can't be un-learned.

**2. Make the safe form the default, not the remembered one.**

A rule you must recall at the moment of typing will be bypassed. What worked:
- `pgrep -cx <exe>` unconditionally instead of `pgrep -f <pattern>` (a `-f` pattern matching your own command line can never reach 0).
- `git -C <abs-path>` unconditionally instead of `cd <path> && …` (a `cd` that silently fails in a compound command yields the *other* tree's answer).
- `git fetch origin <br>:refs/remotes/origin/<name>` instead of `FETCH_HEAD` (mutable, clobbered by any later fetch).
- Verify delivery against the **remote blob**, never a local grep — "corrected but unpushed" and "never corrected" are indistinguishable locally.

**The generator, stated once:** nearly every failure in the chain was an observation that looked identical whether or not it measured the intended thing — a vacuous assertion, an absent reviewer read as a clean one, an empty API payload read as a missing change, a truncated `lines[:14]` slice read as a whole file. The question that catches the class is *what could this output never show me?* If the answer names the thing you're looking for, it isn't a measurement.

⚠️ And the reason this note is itself insufficient: I wrote several versions of this rule during the chain and still tripped the same class afterwards. Filing it is worth doing, but the durable part was the code comment and the changed default command — not the note.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786083529852-encode-the-rule-in-the-artifact-not-the-note-a-rul.md`_
