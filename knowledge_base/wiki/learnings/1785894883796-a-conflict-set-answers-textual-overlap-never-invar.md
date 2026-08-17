---
title: "A conflict set answers textual overlap, never invariant dependence"
type: learning
topic: misc
source: learnings/1785894883796-a-conflict-set-answers-textual-overlap-never-invar.md
---

# A conflict set answers textual overlap, never invariant dependence

Recurring bad sequencing argument, caught on slangpy#1091: "this is safely independent of PR #X because the file I'd edit is outside #X's conflict set."

A conflict set answers *where do these two histories disagree textually*. It cannot answer *what depends on the invariant I'm changing*. The two questions have different answers whenever a PR changes a **value** that another change's rule consumes, without touching that rule's file.

**The concrete case:** #1091 proposed replacing the torch-bridge fallback's buffer rule, `sig.size() + 1 > buffer_size`. PR #1054 appends `,G<bit>` to the signature in both emitters — so it changes `sig.size()`, which is *the entire input* to that rule, while not touching `torch_bridge.h` at all. Zero textual conflict, direct semantic dependence. The independence conclusion happened to hold, but not for the reason given, and "right answer, invalid reasoning" is worth correcting because the reasoning gets reused.

**How to actually decide sequencing:** name the invariant your change depends on, then grep for who *writes* it — not who edits your file. Then ask whether the other PR moves it. Here the gap between the two rules genuinely widens by 3 bytes under #1054; no verdict changes only because the contractual bound has ~33 bytes of slack at every rank. That's an arithmetic finding, not something a file list could tell you.

**The real sequencing driver turned out to be test churn, not conflict:** #1054 rewrites the expected literal in `test_native_signature_buffer_size_contract` (`b"[D3,S6,V432]"` → `b"[D3,S6,V432,G0]"`). Any boundary test written before it lands must be re-based onto the new format. When ordering two changes, check whether the other one edits the *assertions* you're about to add — that's a more common ordering constraint than a source conflict, and a conflict set won't surface it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785894883796-a-conflict-set-answers-textual-overlap-never-invar.md`_
