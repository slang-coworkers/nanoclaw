---
name: feedback_a_batch_census_needs_the_owner_column_not_the_reply_column
description: "On a fanned-out batch, 'which issues still need work?' measured by ABSENCE OF A REPLY returns a list that is already fully owned. Measured 2026-08-05 (jkiviluoto's 25-issue departure scrub): a peer's 10 'unanswered' issues ALL had live sessions (9x2, 1x1; controls #8527=2, garbage=0). Reply-absence and owner-absence are different columns; only the second licenses a dispatch."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-8527-scrub
---

# ⛔ A batch census must read the OWNER column, not the REPLY column

**2026-08-05, shader-slang/slang #8527 chain.** jkiviluoto-nv posted an identical "scrub this issue"
request to **25 issues** (enumerated, `search/issues?commenter:…+updated:2026-08-05`, total_count=25,
enumerated=25, positive control `8527`→1). The triager handed me a follow-up list: **10 of the batch
"still unanswered"** — #4846 #6471 #6518 #6519 #6540 #6542 #6572 #6578 #6607 #10181 — offering them as
next dispatches.

**Measured before dispatching any of them:**

```
issue   live sessions on that thread (any group)
#4846  2   #6540  2   #6578  1
#6471  2   #6542  2   #6607  2
#6518  2   #6572  2   #10181 2
#6519  2
positive control #8527 → 2 (known)     zero control slang-99999999 → 0
```

⇒ ⭐⭐⭐ **All ten were already owned.** The census was correct about what it measured (no
`nv-slang-bot[bot]` comment yet) and **silent about the thing the dispatch decision turns on** (does a
session already hold this?). Dispatching from it would have created a *second* session on every one of
ten threads — the duplicate-work shape, ten times, under one shared bot identity.

⭐⭐ **The two columns come apart exactly when a fan-out is young.** 51 sessions were created in ~4
minutes; a session that exists but hasn't finished its first turn has *no comment yet by construction*.
So **early in a batch, reply-absence measures elapsed time, not need** — and it reads as a worklist.

## How to apply

- For "what still needs dispatching?", the predicate is **owner-absence**, not reply-absence:
  `ncl sessions list --limit 10000 | grep -c "<repo>-<n>\( \|$\)"` per candidate, with a positive control
  (a thread you know is owned) and a zero control (a nonexistent thread number).
- **Anchor the grep.** Bare `grep -c 6542` also matches session ids and other threads; `\( \|$\)` pins the
  end of the thread key. (Cf. [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]], where a
  bare number-grep matched session ids and a column-shifted `awk` returned a false zero for all six.)
- **Bound the list first.** `--limit 200 → 200` and `--limit 2000 → 2000` are both **pages**; the true
  total was **2290** (stable at 10000). A count equal to `--limit` is a page by definition.
- ⭐ **Say so when you could not verify.** My per-issue verification loop was denied by a tool hook on the
  first attempt; I told the peer the list was unverified rather than letting silence read as confirmation.
  It then explicitly stopped treating the list as jointly held — **an unstated non-answer would have been
  inherited as agreement.**

## ⛔⭐⭐⭐ THE PREDICTED DAMAGE THEN HAPPENED — I dispatched from the reply column ~40 min after writing this

**Same incident, same batch, same issue numbers.** At 20:15 I measured "6 of 18 still owe a comment"
using **bot-comment-count** — the reply column — and told the triager to **redrive** #10181 #6607
#7209 #6540 #4846 #9872, "serialized rather than fanned out." Every one of those six is in the ten-issue
table above, each already carrying **2 live sessions**. The second session was **mine** (Orchestrator
`ag-1776713211742-1w6l4e`); the host had fanned jkiviluoto's webhook to both groups at 18:40Z.

**Outcome, exactly the shape this note predicted:**
- **#10181 DOUBLE-POSTED** — my session's `5196891201` at 20:19:39Z, triager's `5196892695` at
  20:19:49Z. **Ten seconds apart**, both `nv-slang-bot[bot]`, on a maintainer's issue.
- **#7209** escaped only by luck of timing (a sibling's comment landed 20:18:08Z, *after* my 20:15
  census, so the triager's pre-post check happened to see it).
- **#6540 / #4846 / #9872** avoided only because the triager **asked me to confirm ownership before
  continuing** instead of complying. Had it obeyed silently: three more collisions.

⛔⭐⭐⭐**The rule was in this store, written by me, about THESE issue numbers, and it did not fire —
because I came back with a different question.** Writing it, I asked *"what still needs dispatching?"*
(→ owner column). Forty minutes later I asked *"did the 429 wave finish?"* (→ reply column, correctly)
and then **let the recovery metric double as a worklist.** ⇒ ⭐⭐⭐**A coverage metric and a dispatch
predicate are different instruments even when they return the same-shaped list. Progress-tracking is
the reply column; dispatch authority is the owner column. The moment a coverage number becomes a
to-do list, re-derive ownership.**

⛔**And my "safeguard" made it worse by looking like one.** I told the triager to re-check bot-comment
count before each post. **A check-then-act guard cannot close a race against a concurrent writer under
a shared identity** — it narrows the window and reads as protection. Under one bot identity a peer's
in-flight write is invisible until it lands, so a `bot=0` read is *evidence about the past, never a
claim on the resource.* ⇒ **Deduplication belongs at DISPATCH; downstream the only repair is
post-then-reconcile.** (Which the sibling did do: a public "treat this as one recommendation, not two
votes.") Cf. [[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]],
[[feedback_sibling_write_under_shared_bot_identity]].

⭐⭐**The one thing that worked was a subordinate refusing to act on my instruction until I verified a
premise it could not see.** It held no cross-group instrument; I did. **Escalating "I can't see whether
others are on this list" beat complying.**

### ⛔⭐⭐ THE OPPOSITE DEFECT ON A SIBLING CHAIN: a scrub WRITTEN but never POSTED

Cleaning up the same batch, **#6540** read `bot=0` — and that zero was **real, not an ownership
artifact**. Its Orchestrator session had written a **complete scrub into a chat message** at 20:20
("Naming one: #6540. Full scrub below — I ran it myself while your session was wedged…") and **never
posted it to the issue.** No comment id anywhere in its transcript; `gh api …/6540/comments` filtered
to bot → 0. A maintainer landing on #6540 sees nothing, while the session's own transcript reads as
finished work.

⇒ ⭐⭐⭐**On a batch, `bot=0` is AMBIGUOUS between three states — never-started, owned-and-in-flight,
and done-but-unposted — and only the third is invisible from both columns.** The owner column says
"owned" (true), the reply column says "no reply" (true), and the work is *complete and undelivered*.
⇒ **The deliverable is the artifact on the public surface, never a message about it**
([[feedback_an_in_place_edit_notifies_nobody]] family: storage ≠ receipt). When reconciling a batch,
for any `bot=0` **read the owning session's tail** — a transcript that describes a finished verdict
with no comment id is the tell.

⚠️**Both failure directions came from one wave:** the 429s wedged chains mid-flight, so some sessions
died before posting and others resumed and posted twice. **A rate-limit event does not fail cleanly in
one direction** — reconcile for duplicates *and* for undelivered work.

## ⛔ The second defect in the same turn: I RE-DERIVED a stored rule instead of recalling it

I measured the 429 cause from scratch (51 sessions in 4 min ⇒ self-inflicted, don't escalate to the
provider, don't retry) and only afterwards read
[[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]] — which already contains that
finding, **measured on this same burst** (its window: 52 sessions in 5 min, 429s in 6/6 sampled sessions).
Same incident, slightly different slice.

⇒ ⭐⭐ **The re-derivation was not wasted — it produced the same answer, which is corroboration — but I
spent the turn's budget rediscovering a conclusion I had already paid for.** The index row for that rule
exists and I did not open it before measuring. **The store's failure mode is not absence; it is that a
rule fires on the query you INVESTIGATE with and stays silent on the one you ACT with.** Cf.
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] (same asymmetry, opposite polarity).

Related: [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] (bound the list; `--agent-group`
does not exist and unknown flags return unfiltered data at exit 0 — reconfirmed here: garbage value → all
11 groups, exit 0), [[feedback_last_active_tracks_inbound_not_agent_work]] (why I read the transcript
instead of the column before nudging).
