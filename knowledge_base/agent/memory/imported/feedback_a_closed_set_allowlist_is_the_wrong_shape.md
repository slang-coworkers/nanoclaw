---
name: feedback_a_closed_set_allowlist_is_the_wrong_shape
description: "My is_bot flag is minted from a closed two-element login set and consumed as authoritative, so coderabbitai/github-actions read as human — the fix is __typename==Bot, not a longer list."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 65aeceb1-eb91-42c3-81c3-c0a233e60a7e
---

⛔ **2 of 15 supervisor nudges were FALSE because `is_bot` is an allowlist lookup, not a predicate.** Measured 2026-08-09, tick 127.

```
pull-universe.sh:323/439/443/530/537   is_bot = author in bot_logins
bot_logins default                     ["nv-slang-bot[bot]", "nv-slang-bot"]   <- closed, 2 elements
scan.py:142                            treats the boolean as AUTHORITATIVE when present
```

`coderabbitai` and `github-actions` aren't in the set ⇒ they read as humans ⇒ "human spoke last, unanswered" fires on chains whose owners had **already refuted it up to four times**.

⭐⭐⭐ **The failure is the allowlist's SHAPE, not its contents.** Enumerating the two names fixes two rows and leaves the next unknown bot mis-typed. `__typename == Bot` (GraphQL) or the API's per-comment `is_bot` is the **predicate**; a list is at best a fallback. Reached independently by `slang-pr-approver` and `slangpy-fixer`. ⚠️ The API strips `[bot]` from `login` in some views — likely how suffix-matching lost them; test the suffix only on the **un-normalized** value.

⭐⭐⭐ **A derived boolean discards the evidence that would let a later stage disagree.** Any *authoritative-when-present* field turns an upstream bug into an uncorrectable one — **a fix in the consumer is INERT**, which is why this fired twice more after being declared fixed. Same class as a grep over wrapped prose.

⛔ **The variant no list can ever fix:** `jhelferty-nv` — a real `User` account — posts PR-board-sync notices marked *do not reply*. **A human account emitting bot content**; 5 chains falsely flagged in one tick. Only discriminator is the body marker `<!-- pr-board-sync-assignment -->`, and my payload is deliberately body-less ⇒ **schema change (payload must carry a content field), not a data change.**

⚠️ **Don't collapse all bots into one class.** *Our* bot speaking last ⇒ nothing owed, the trailing comment IS the artifact. A *third-party* bot (CodeRabbit review landing last) may be a real inbound. One direction produces false nudges, the other missed work.

✅ **Method note:** name the distinguishing observation **before** knowing the answer — *"does the scanner classify `coderabbitai` as a bot at all?"* A test chosen afterward confirms whichever story you already told.

See also [[feedback_a_stored_claim_re_shipped_as_a_live_finding]] (same tick, different mechanism).
