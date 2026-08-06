---
name: feedback_an_answered_ask_is_a_deadline_not_a_notification
description: "We asked a maintainer for a design decision, got it 4.5 min later, and left it unanswered 35 min — the inverse of treating an unanswered offer as consent; a reply to our own question is the one inbound that cannot be deferred."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aebc885f-7375-455f-9fc5-9d4f8866e5a9
---

⛔ **MEASURED, slang#11709 (2026-08-05): `jhelferty-nv` 20:43:59Z — `"@nv-slang-bot I think the
E38034 sibling should land here."` Zero bot comments after it (`created_at > that` → 0), 35 min
elapsed when I caught it, and it surfaced only because a *different* chain's triager flagged it in
passing.**

The reply is to **our own** 20:39:31Z comment, which had asked:

> *"I'd like your call on whether the E38034 sibling lands here or as a linked follow-up, because
> it is new diagnostic surface rather than a fix to what's already in the diff."*

⭐⭐⭐ **A reply to a question we asked is not a notification — it is a decision we said we were
blocked on, arriving.** We named it as needing *their* call, then didn't consume the call. That is
strictly worse than ignoring an unsolicited comment: we established the dependency publicly, so the
maintainer is now entitled to assume the work is moving.

⭐⭐ **This is the exact inverse of
[[feedback_an_unanswered_offer_becomes_a_request_in_the_retelling]], and both landed in the same
hour on adjacent chains.** Same axis, opposite errors:

| | our utterance | their utterance | our error |
|---|---|---|---|
| #12372 | offer to file | **silence** | treated silence as **consent** |
| #11709 | request for a decision | **an answer** | treated an answer as **nothing** |

⇒ **The failure is not "we're too eager" or "we're too slow" — it's that the human's actual speech
act is not being read.** A rule that only fixes one direction ("don't assume consent") leaves the
other live. The durable form: **for every ask we publish, the reply is a tracked inbound with an
owner.**

⚠️ **Why the natural instruments miss it.** (a) The mention is a *reply on a long PR* — #11709 has
**64 comments**, so it reads as more thread traffic, not as an unblocking event. (b) Bot-authored
comments dominate the thread (~2:1), so "recent activity exists" is true and uninformative. (c) A
per-chain "did anyone reply?" check answers yes — a comment did arrive; nothing flags that it
answers a question *we* posed.

✅ **Detector: for each `@our-bot` mention, count bot comments with `created_at >` the mention.
0 = unanswered, regardless of how busy the thread is.** Cheap, non-circular, and it does not care
about volume.

⚠️ **Two instrument traps hit while measuring this one:**
- **`gh api .../comments` default-pages at 30** — `comments:64` on the issue object vs 30 rows
  returned. Use `--paginate ... per_page=100` (→ 64) or the newest comment, i.e. the one that
  matters, is invisible. Same head-window family as
  [[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]].
- **`gh search issues E38034 --repo …` → `[]`** with a garbage control also `[]` ⇒ the control does
  not discriminate here; GitHub does not index that token in bodies. Do not read it as "E38034
  appears nowhere" — the string is demonstrably in comment `5197080896`.

⭐ **Route by branch, then pin by session.** `fix/issue-10641` ⇒ coworker PR ⇒ `slang-fixer`; and the
live `gh-issue-…-11709` session is owned by the *same* group (`ag-1780667166439-vmjrwe` =
`slang-fixer`), so wake **that** session with `target_session_id` instead of minting a cold one that
would re-derive 64 comments of context.

⚠️ **What I could not establish:** whether the fixer has already seen the mention in-session.
`grep -ic "E38034"` over its session → 0, but `ncl sessions messages` **truncates row text**, so
that is a partial read, not absence. Dispatched as *"if you already have this, ignore"* rather than
asserting it hadn't seen it.
