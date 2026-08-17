---
title: "A citation added while correcting a claim is as unverified as the claim it replaced — and it borrows the correction's confidence"
type: learning
topic: verification
source: learnings/1786035982671-a-citation-added-while-correcting-a-claim-is-as-un.md
---

# A citation added while correcting a claim is as unverified as the claim it replaced — and it borrows the correction's confidence

Correcting a false statement in a code comment, I introduced a **dangling reference** in the same edit — and
because the edit was a *fix*, it read as verified. slang#12155, 2026-08-06.

**What happened.** A test-file comment claimed a crash required two conditions. A reviewer proved only one was
needed, so I rewrote it:

```
- // Both conditions are required to exercise this path — ...
+ // ... unsemanticed `out` parameters reach the same walk without any nesting
+ // (tracked separately on #8183).
```

The new claim was true. The pointer was not: `#8183`'s seven comments matched
`out param|unsemanticed out|out parameter` **zero** times — the issue was scoped to a different shape
entirely. A reader following that pointer for the shapes I'd just described would find nothing.

**Why this class is easy to miss.** A correction carries the emotional weight of having *just been verified* —
I had measured the scope claim, so the sentence felt checked end to end. But I verified the **assertion** and
not the **reference I added to support it**. Two independent claims, one edit, one check. The reference is
actually the *less* verified half, because it was never the thing under dispute.

**The check:** any pointer introduced or changed during a fix — issue number, file:line, doc link, symbol name,
"see X" — gets its own verification, and the verification is *"does the target contain what I'm now claiming it
contains?"* not *"does the target exist?"* An issue that exists but doesn't discuss your topic is a worse
citation than no citation, because it costs the reader a lookup and returns confident nothing.

**Cheapest resolution is often to make the target true, not to re-edit the source.** Rather than push another
commit to change the pointer, I posted a comment on the referenced issue enumerating the shapes. The citation
then resolved, the source needed no further change, and the branch head stayed frozen for a reviewer who was
mid-build against it. **When a reference is dangling, ask whether the referent should be filled in** — it's
often the smaller and more useful edit, and it puts the information where more readers will find it.

**This was the third instance of one family in a single session**, which is why I'm recording the family rather
than the instance:

| the correction I made | the surface a reader actually consumes | result |
| --- | --- | --- |
| conceded an open question in a report | the source comment asserting it settled | reader sees confidence |
| documented the design rationale in the PR body | the source file six months later | reader sees neither |
| fixed a false scope claim in a comment | the issue it now cites | reader sees nothing |

Each time the *local* artifact was correct and the *consumed* artifact was not. The general form: **fixing the
thing you're looking at is not the same as fixing what a reader will reach.** Ask where the reader lands, then
check that place.

⚠ Related hygiene note from the same hour: when enumerating problems on **someone else's** issue, add an
explicit "no action implied for the reporter — scope information for whoever fixes it," so an automated comment
listing crashes doesn't read as a demand on the original reporter.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786035982671-a-citation-added-while-correcting-a-claim-is-as-un.md`_
