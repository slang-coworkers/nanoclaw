---
title: "A claim about what code does needs the code read; sharpening a peer's unverified claim adds authority without adding a check"
type: learning
topic: verification
source: learnings/1785882828063-a-claim-about-what-code-does-needs-the-code-read-s.md
---

# A claim about what code does needs the code read; sharpening a peer's unverified claim adds authority without adding a check

Two coupled failures from one incident, worth separating because the second is the more dangerous.

## 1. Inferring design intent from a symptom

**Observed:** maintainers were auto-assigned and review-requested within ~30s of a bot **draft** PR opening in `shader-slang/slang-rhi`, even though the bot is forbidden from requesting reviewers and opens every PR as a draft precisely to avoid that.

**Concluded (wrongly):** "the guardrail doesn't achieve its purpose — draft status doesn't suppress the ping, so it's a gap in the automation." A bot-author opt-out was drafted as a proposal to maintainers.

**What the code actually says** (`shader-slang/slang/.github/workflows/pr-board-sync.yml`):

```js
:1391   if (info.isDraft && !info.isBot) return;   // human draft: author's "not ready"
:1197   if (info.isDraft) return info.isBot ? STATUS.inreview : STATUS.revising;
:1182   // "a Bot draft is In Review, since bot PRs arrive as drafts and a human
        //  owner must see/shepherd them."
```

It skips human drafts and routes bot drafts **deliberately**, with the rationale inline one line above the branch. Routing bot work to a human owner is the intended behaviour, not an oversight. Proposing an opt-out would have asked maintainers to undo an intentional decision — for a bot's convenience, in a thread where they had just raised review load.

**The mechanical tell:** *"the guardrail doesn't work"* is a claim about code, and the code had not been opened. Any assertion of the form *"the system doesn't do X"* / *"X isn't handled"* / *"this is a gap"* is a code claim. A symptom is what prompts the question; it is never the answer. Before asserting a gap, find the branch that decides the behaviour and read the comment next to it — design intent is very often written down right there.

## 2. Sharpening a peer's claim is not verifying it

The supervising tier took the "gap" framing, made it crisper and more general ("this fires on both repos, so it's every bot draft"), and prepared to escalate it. Nobody checked the draft branch at any point.

**Sharpening adds your authority without adding a check.** It is more dangerous than the original assertion, because it is the step that carries an unverified claim outward to people who will act on it — and the improved wording makes it *sound* better-founded. A downstream agent's diagnosis is a **finding**, not an established fact, until receipts have been seen. If you are about to restate someone's claim more confidently than they did, that is the moment to ask for the file and line.

## Related discipline that held
- Softening "he ranks top on commits to the touched files" → "one of its selection inputs", because no ranking output was ever obtained. A ranking claim needs the ranking; plausibility is not measurement.
- Citing **no** line numbers for code not read line-by-line, rather than approximate ones. An unverified citation is worse than none — it invites a reader to check something you never checked.

Same family as: a bounded grep returning zero is a fact about the boundary (`uses:` lines are search boundaries), and refuting one cause licenses nothing about the replacement.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785882828063-a-claim-about-what-code-does-needs-the-code-read-s.md`_
