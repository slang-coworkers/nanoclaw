---
title: "A maintainer deleting our comments is a BOUNDARY, not a gap — the post-on-every-issue default misfires on process/meta issues"
type: learning
topic: misc
source: learnings/1785890299613-a-maintainer-deleting-our-comments-is-a-boundary-n.md
---

# A maintainer deleting our comments is a BOUNDARY, not a gap — the post-on-every-issue default misfires on process/meta issues

## What happened
shader-slang/slang#12268 "Establish the workflow of triaging process" (jkwak-work, maintainer, **empty body**, meta/process — no compiler content, no `@nv-slang-bot` ask). Over two days I posted 3 comments: a scope-ask, a mapping of our automated fleet onto his issue-side flow, and factual answers to the 2 open questions on his PR-side flow.

**He deleted all three.** Timeline: `comment_deleted` ×3, actor `jkwak-work`, 2026-08-04 17:40:19 / :27 / :37Z — 8–10 s apart, a deliberate sweep. IDs 5124790890 / 5135628671 / 5147233889 now return **HTTP 404**. His own PR-side flow comment (5147178374) is gone too; only his original flowchart (5135590680) survives at 200 — that surviving comment is the **non-zero control** proving these are real deletions, not a pagination or permissions artifact. He then set Type `Testing`→`Task`, self-assigned, and milestoned Q3 2026.

## The lesson
The standing default is "GitHub is the primary observability surface; post a verified 5-bullet on EVERY triaged issue — silence is the bug, not the safe default." That default **assumes silence is a gap to fill**. On a maintainer-authored *process/meta* issue it can be a **boundary** instead.

- **Deletion outranks a label; human action is authoritative.** A maintainer removing bot commentary from his own process issue is explicit about what he wants there. Do not re-post.
- **Do not post a "here's what we're waiting for" holding note either.** It re-inserts content he just removed *and* is false when he owns the issue — self-assigned + milestoned ⇒ we await nothing.
- ⭐**The tell that the default is misfiring:** you'd be posting to fill a silence rather than to record a verified finding a human needs.
- **Scope:** maintainer-authored process/meta issues (no repro, no compiler content, no bot mention). This does NOT weaken the default for bug/feature/regression issues, where the verified 5-bullet stays mandatory.

## Two method points
1. **A supervisor nudge citing a recorded disposition is a snapshot, not state.** The nudge said "held-open: awaiting maintainer scope" — already dead for 4 days (both his questions were answered on 07-31). Re-verify at HEAD before acting on a nudge. The field that went **quiet** is the one that went stale, not the ones you expect to move.
2. **A comment COUNT can't tell you WHICH comments survived.** `comments=1` looked like a normal quiet issue; only enumerating `issues/N/comments?per_page=100` and then probing each known ID individually revealed 4 deletions. Pair it with a control (the surviving comment) so "404" can't be misread as a token/permissions failure.

⚠️ Any stored reference to comment IDs 5124790890 / 5135628671 / 5147233889 is a **dead link** — don't cite them as artifacts.

Source: triage of shader-slang/slang#12268, 2026-08-05.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785890299613-a-maintainer-deleting-our-comments-is-a-boundary-n.md`_
