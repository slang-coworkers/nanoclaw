---
title: "in_reply_to selects the edge, not the session — set thread_id explicitly"
type: learning
topic: agent-ops
source: learnings/1786069209416-in-reply-to-selects-the-edge-not-the-session-set-t.md
---

# in_reply_to selects the edge, not the session — set thread_id explicitly

## The failure

A supervisor sent three messages of `#11225` context to a session working `#12284`. Both sessions live in the same agent group behind one destination name, and the group had ~19 concurrent sessions.

The sender used `in_reply_to` and assumed it carried the thread. From their own DB rows:

```
irt=a2a-…u6tg9h  thread=gh-issue-shader-slang/slang-12284   ← should have been -11225
irt=a2a-…u6tg9h  thread=gh-issue-shader-slang/slang-12284   ← same irt twice
irt=a2a-…t2sgh5  thread=gh-issue-shader-slang/slang-12284
```

**`in_reply_to` does not carry a thread when the inbound it references is itself thread-less.** Every inbound row from that group had `thread_id = NULL`, so the runtime fell back to the most recent thread known for that peer — the wrong session's. The positive control: a message in the same batch that carried an explicit `thread_id` landed correctly. **Only the messages with an explicitly-set thread routed right.**

So: `in_reply_to` resolves the **edge** (which peer), not the **session** (which of that peer's N concurrent conversations).

## The rule

Set `thread_id` explicitly on every message to a multi-session group. Do not rely on `in_reply_to` to derive it — the derivation silently succeeds with the wrong value.

Sender-side tells that you are about to misroute:
- your outbound row shows `thread=None`
- two outbound rows share one `in_reply_to`
- the inbound you are replying to has `thread_id = NULL` (then there is nothing to inherit)

## The receiving-side detector, which is cheaper and worked

The recipient caught this, not the sender, with two checks:

1. **Content-vs-store:** the messages referenced `#11225` and slangpy; `ls memory/fix-*.md` and the `active-work/*/target` sentinel showed only `#12284` work and **zero** `11225` or slangpy artifacts. A file in your store is not evidence you wrote it, and its *absence* is good evidence you didn't.
2. **Internal contradiction:** two messages in the same batch assigned the recipient **opposite session ids**. That is impossible for one session and is the strongest single tell — it cost one read to spot and is what sent the sender to the ledger.

Generalizes to: when handed context that does not match your own artifacts, check your store before absorbing it. Accepting misrouted work quietly corrupts your provenance and can duplicate another session's effort on a shared filesystem.

## Related

Same root as [[technique_container_scoped_paths]] — N sessions behind one destination name means a *name* carries no attribution. The fix is a key (`thread_id`, session id), not more care.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786069209416-in-reply-to-selects-the-edge-not-the-session-set-t.md`_
