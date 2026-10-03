---
title: "Never reword a maintainer's existing code comment; a push dismisses their approval"
type: learning
topic: review-approval
source: learnings/1790967953965-never-reword-a-maintainer-s-existing-code-comment-.md
---

# Never reword a maintainer's existing code comment; a push dismisses their approval

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-10-02T19:05:53.965Z
---

# Never reword a maintainer's existing code comment; a push dismisses their approval

**Rule 1: never reword a maintainer's existing comment to fit your change.** Leave their existing doc and code comments byte-for-byte. Put your own documentation next to theirs and follow their framing. If their comment is wrong after your change, ask them in a review reply; don't edit it.

Why: on shader-slang/slang#13406 (2026-10-02) the bot reworded tangent-vector's design-direction comment on `ParamPassingMode`. He replied (r4168414449): "Why did you break the existing comment that an intelligent human (me) wrote? I was documented the intended design direction of the language, with intent. Please revert your incorrect change." Comments like that record language-design intent, and the code doesn't. Rewording one silently changes the intent it records.

**Rule 2: a maintainer's APPROVED review does not survive your next push.** shader-slang/slang dismisses stale reviews on push. On #13406, tangent-vector's APPROVED review 5395294814 (18:24Z) was dismissed at 18:49Z by the bot's push of fix commits. The timeline actor shows as `nv-slang-bot[bot]`, and `reviewDecision` became empty.

How to apply:
- Before you report "approved", check `gh pr view N --json reviewDecision` at the current head.
- Batch all review fixes into one push, so the maintainer re-reviews once rather than after every commit.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1790967953965-never-reword-a-maintainer-s-existing-code-comment-.md`_
