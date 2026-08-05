---
title: "Session identity — git authorship is also a group identity, and the swap was one-directional"
type: learning
topic: agent-ops
source: learnings/1785871175369-session-identity-git-authorship-is-also-a-group-id.md
---

# Session identity — git authorship is also a group identity, and the swap was one-directional

# Addendum to `1785870965791-a-group-name-is-not-a-session-identity-340-session.md`

Two facts measured **after** that note was written. It already covers the core rule (`from=` identifies the
group, `thread=` identifies the speaker); this adds the git-layer half and closes the symmetric check its
last section calls for.

## 1. Commit authorship cannot separate sessions either

The parent note establishes that the chat sender name is a group label. The same is true one layer down:
every session in the group pushes as the **same** git author.

```
fix/issue-11917-batch3  →  a282ebcd35   19:00:43Z   author=nv-slang-bot[bot]   ← session A
fix/issue-10641         →  4a43eb45d8   18:53:52Z   author=nv-slang-bot[bot]   ← session B (different session)
```

⭐ **So `git log --format=%an` / `%ae` is useless as a session discriminator, exactly like `from=`.** A reader
trying to work out *which* session produced a commit gets a group identity from the authorship field and
must fall back to **branch** (or the thread that owns it). Branch and thread agree; author does not
distinguish.

This matters because authorship *feels* more authoritative than a chat label — it is durable, cryptographic,
and in the permanent record — so it is the natural place to go looking for identity after being burned by the
sender name. It answers a different question: *which group pushed this*, not *which session*.

## 2. The symmetric check: the swap was one-directional

The parent note's closing instruction is to *ask whether the other session was credited with your work in
exchange*. Ran it. **It was not.** The two heads sit on distinct branches with distinct messages
(`a282ebcd35` "Merge remote-tracking branch 'origin/master'…" vs `4a43eb45d8` "Bracket the string-hash
test's negative checks…"), and no work moved in the other direction.

⭐ **So an attribution swap is not necessarily symmetric — check, don't assume it.** Assuming symmetry would
have produced a second, fabricated correction: telling session B it had been credited with A's push when it
hadn't. That is the *phantom correction* failure mode — a wrong subtraction is as damaging as a wrong
assertion, and harder to challenge because it presents as scrupulousness.

⇒ Verifying the reverse direction cost one API call and prevented publishing a made-up retraction.

## The read-side rule both halves point at

⭐ **Name the field before quoting the value.** Every misread in this session had the correct field present
in the same payload, one field over: `submitted_at` read as a dismissal time (the dismissal is a separate
`review_dismissed` event), `compare/A...B`'s `behind_by` read as describing A when it describes B, a review's
`state` read as current when it needed `commit_id` for currency, `from=` read as a speaker when `thread=` is
the speaker, and `%an` read as a session when it is a group.

**If you cannot name which field answers the question, you do not have the answer — you have a nearby
number.** Care is not the remedy: a confident reading of the wrong field feels identical to a correct one,
which is why no check gets scheduled.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785871175369-session-identity-git-authorship-is-also-a-group-id.md`_
