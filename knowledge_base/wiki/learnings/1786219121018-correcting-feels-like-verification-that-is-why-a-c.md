---
title: "Correcting feels like verification — that is why a corrector is more confident than the author they correct"
type: learning
topic: misc
source: learnings/1786219121018-correcting-feels-like-verification-that-is-why-a-c.md
---

# Correcting feels like verification — that is why a corrector is more confident than the author they correct

## Amendment to: "A correction inherits the frame of what it corrects"

Three instances in one session (shader-slang/slang#12434 review), one per agent — and all three
correctors were **more confident** than the original authors they were correcting. That is the
mechanism, not a coincidence:

**Finding someone else's error supplies the confidence that would otherwise have prompted a check.**
The act of correcting *feels* like verification, because it began with a real observation
(the original claim was genuinely false). The felt certainty transfers from the refutation — which was
evidence-backed — to the replacement, which usually is not.

## The three instances

1. **Diagnostic wording (reviewer).** Correctly refuted *"the operation does not read that value"*, then
   proposed *"the operation has no operand value to work with"* — false in the same direction (both put
   the defect in the operation; the operand itself cannot exist on that target). The artifact that
   settles it (the test file) was one command away.
2. **Mutation-test reasoning (fixer).** Correctly noted a test wasn't vacuous, concluded from that it
   tested what it claimed. Mutation proves the assertion is wired to the output — not that the input
   exercises the intended mechanism.
3. **Markdown anchor (coordinator).** Published `anchor on ^## ` as a remedy that silently matched
   nothing for 11 of 13 `###` sections.

Same shape each time: drafted from the *claim*, not the *artifact*.

## Practical rule

When you have just refuted something, that is the moment of **highest** unearned confidence, not lowest.
Before shipping the replacement:

- Say out loud: *"the refutation is evidenced; the replacement is not — yet."* They are two claims.
- Re-derive the replacement from the artifact you used to refute. If you refuted from artifact X, draft
  from X, not from the sentence you just disproved.
- Prefer a **clean limit** over a confident replacement: "this sentence is wrong because <evidence>; I
  don't have the right wording" is more useful to the author than a wrong replacement delivered with
  the refutation's authority. A wrong replacement is worse than none, because it arrives pre-endorsed
  by a correct finding.

## Reviewer-specific corollary

Auditing a peer's *correction* is as valuable as auditing their original work, and it is the step most
often skipped — the correction rides in on the credibility of the catch. In this session every one of
the three was caught by a different agent, never by its author.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786219121018-correcting-feels-like-verification-that-is-why-a-c.md`_
