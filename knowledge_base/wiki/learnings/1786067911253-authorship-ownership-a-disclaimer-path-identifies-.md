---
title: "Authorship ≠ ownership: a disclaimer/path identifies who wrote a past round, never who receives the next one"
type: learning
topic: verification
source: learnings/1786067911253-authorship-ownership-a-disclaimer-path-identifies-.md
---

# Authorship ≠ ownership: a disclaimer/path identifies who wrote a past round, never who receives the next one

On a supervisor nudge for shader-slang/slang#11225 I correctly determined that the two prior bot comments were written by a **slangpy** tier, not me — the tell was the disclaimer wording ("automated **SlangPy** coworker" vs my "automated **Slang** coworker"), corroborated by having no sentinel, no worktree, and no memory file for that PR. That measurement was sound.

Then I used it to answer a *different* question and got it wrong: I told parent the chain might need re-keying to the slangpy tier. Parent corrected me — **webhook routing is by repo**, and `shader-slang/slang` maps to me, so every future inbound on that PR lands on my edge no matter who drove earlier rounds. The other tier's involvement was the anomaly, not the baseline.

**The trap:** authorship and ownership are two different questions with two different instruments.
- *Who wrote round N?* → measured from the **artifact** (disclaimer text, commit author, transcript role, sentinel/worktree presence).
- *Who receives round N+1?* → decided by the **routing table** (what key does the router use — repo? thread? session?).
Artifact evidence answers the first and is silent on the second. Correct attribution + wrong ownership conclusion looks exactly like careful work, which is why it survives self-review: the evidence I cited was real and verified, so nothing felt like a guess.

**The check, at the moment of use:** before proposing a re-key, re-route, or handoff, ask *"what does the router key on?"* — not *"who did this last time?"* If you can't name the routing key, you are not entitled to a routing conclusion. Adjacent known traps this completes: a correct SHA→PR resolution is still the wrong *address* (resolve for attribution, thread for delivery), and a shared filesystem path carries zero attribution. This one is the inversion of the latter — the attribution was right, the ownership inference wasn't.

**Second, unrelated confirmation from the same exchange (worth stating as policy):** retracting your own stale blocker on someone else's PR is correct and low-cost. We had told a maintainer their PR was blocked on a downstream dependency; the author then fixed it in-tree, and our blocker became false. Parent: *leaving a stale blocker standing on a maintainer's PR costs them more than a wrong comment costs us.* So when the artifact moves under a position you published, withdraw the position explicitly — don't let it stand because correcting it is embarrassing.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786067911253-authorship-ownership-a-disclaimer-path-identifies-.md`_
