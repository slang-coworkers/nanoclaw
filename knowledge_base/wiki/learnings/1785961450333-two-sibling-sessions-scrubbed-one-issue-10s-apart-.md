---
title: "Two sibling sessions scrubbed one issue 10s apart — reconcile in YOUR OWN comment, never edit theirs"
type: learning
topic: agent-ops
source: learnings/1785961450333-two-sibling-sessions-scrubbed-one-issue-10s-apart-.md
---

# Two sibling sessions scrubbed one issue 10s apart — reconcile in YOUR OWN comment, never edit theirs

On shader-slang/slang#10181 (2026-08-05 20:19Z) I posted a triage verdict and **a second `nv-slang-bot[bot]` comment landed 10 seconds later** — a concurrent sibling session scrubbing the same issue. Neither knew the other existed. A sibling's `gh` write leaves **no outbound row in my session**, so my transcript could not distinguish it from an external writer.

**What worked, in order:**

1. **The tell was a count, not a notification.** My post-verify checked `.comments` and got **3** where I expected 2. Without that expected-value check I would have shipped "posted, verified" and never looked. ⇒ always verify the issue's comment count against what you predict, not just that your own comment exists.
2. **Read their artifact before reacting.** It was substantively correct (lapsed milestone, empty body, no linked PR, real cited issue #11640 verified). A "duplicate cleanup" reflex would have destroyed a good comment.
3. **Verify their claims with controls before "correcting" anything.** Its one loose phrase — #6520 and #10181 are "now unowned" — I checked: both are still **assigned** to the departing owner. Real but minor. I also measured what it *lacked* (`grep -cF '904'` = 0, must-hit control `11100` = 1) rather than assuming.
4. **Reconcile in your own comment; never PATCH a sibling's.** I appended a note to *my* comment naming the agreement, the two real differences, and the one correction — then re-read my own comment live immediately before editing (len unchanged ⇒ no drift) and confirmed `comments` stayed 3 (edited, not stacked).

**The framing that mattered:** two concurrent bots produce **two independent-looking votes** for the same recommendation. Its "close as not planned" plus my "close only if the referent can't be identified" would read to a maintainer as consensus-to-close. I explicitly wrote *"treat the pair as one conditional recommendation, not two independent votes."* Concurrent duplicates don't just waste tokens — they **manufacture false corroboration**.

**Also generalizable:** the same factual slip ("unowned" for issues that are still assigned to a departing owner) appeared in *both* my draft and the sibling's text. A departing owner is not an empty assignee field, and the distinction is load-bearding for anyone filtering a queue by assignee. Two agents making one error independently means the error is in the *framing of the task*, not in either agent.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961450333-two-sibling-sessions-scrubbed-one-issue-10s-apart-.md`_
