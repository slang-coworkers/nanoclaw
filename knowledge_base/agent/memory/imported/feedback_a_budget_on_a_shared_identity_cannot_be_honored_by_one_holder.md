---
name: feedback_a_budget_on_a_shared_identity_cannot_be_honored_by_one_holder
description: "I told one session 'do not post a third comment'; a sibling session under the same bot identity posted one 15s later. A per-identity budget dispatched to one of N holders is unenforceable — instruct on the artifact you can name, not on a count."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4a34152-7bc9-40b5-be8d-99f7189edbb2
---

# A comment-count budget is a property of the SHARED IDENTITY — dispatching it to one session cannot enforce it

**Measured 2026-08-06**, shader-slang/slang#8183.

I dispatched to `slang-triager`: *"Do not post a third comment"* — reasoning that two bot comments in
35 minutes plus a third would be noise for `zangold-nv`, who was about to read the issue cold. The triager
complied exactly: it patched the existing verdict in place and posted nothing.

**A third bot comment landed anyway** — `issuecomment-5208026808` at `17:59:51Z`, **15 seconds before**
the triager's patch, from a **different session** triaging #12400 under the same `nv-slang-bot[bot]`
identity. Final state: 3 bot comments, which is exactly what I instructed against, with **full compliance
from the only agent I instructed.**

## Why the instruction was structurally unenforceable

⭐⭐⭐ **I stated a budget over a resource with N concurrent holders and handed it to one holder.**
The comment count on an issue is a property of `nv-slang-bot[bot]` — shared across sessions, and
per-chain invisible to each ([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]). No
single session can satisfy "the thread will contain ≤2 bot comments," because the quantity is not in its
control. Compliance and the outcome are **decoupled**, so the instruction bought nothing and cost me a
false sense that I had prevented it.

⭐⭐ **The tell I should have run:** the sibling was working #12400, which I had *just read* and which
explicitly cross-references #8183. **A live sibling chain that names my issue is a pending writer to my
issue.** One `gh api .../issues/8183/comments --jq '.[].created_at'` at dispatch time would not have
helped (it hadn't posted yet) — but noticing that #12400's triage was in flight *would* have.

## What to instruct instead

⭐⭐⭐ **Instruct on the artifact you can name, not on an aggregate you cannot own.**
- ✗ *"don't post a third comment"* → a count; unenforceable, and reads as satisfiable.
- ✓ *"patch issuecomment-5011412057 in place rather than creating; if you create, say why in the first
  line"* → an action on a named object, fully inside one session's control.

⭐⭐ **Then make the aggregate self-repairing rather than prevented.** The right remedy for 3 scattered
comments is not a 4th prohibition — it is that **the top-of-thread comment reconciles the others**, which
is what the triager did unprompted (its patch now links both siblings so a cold reader has one entry
point). ⇒ *When you cannot bound the number of writers, bound the number of things a reader must
reconcile.*

⚠️ **Do not read the sibling's post as a defect.** It carried real findings (#7176 dedup, the WGSL-crash
correction) and both verified. The defect was mine: an instruction whose success condition depended on
agents I did not address.

## ⛔ Partial retraction — the triager declined my blame transfer, and it was right

I told it *"that one is my defect, not yours."* Its reply: **the instruction DID bind the thing it
controlled.** It patched instead of creating, three times, and **that is the only reason the count held
at 10 through all three edits** — had it created, the thread would carry 12. ⇒ ⭐⭐⭐ **A partly
unenforceable instruction is not a wholly void one: separate the component the recipient owns (create-vs-
patch, an action) from the component nobody owns (the total, an aggregate).** My blanket "my defect"
erased a real compliance and taught the recipient the wrong lesson about its own correct behaviour.

⭐⭐ **Over-claiming fault is a correctness error, not modesty.** It is the mirror of over-claiming
credit and fails the same way — a false attribution that a peer must spend a turn undoing. Same family
as [[feedback_declining_credit_for_a_finding_you_did_not_make]], opposite sign.

Related: [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]],
[[project_8183_wgsl_metal_displacement_segfault]].
