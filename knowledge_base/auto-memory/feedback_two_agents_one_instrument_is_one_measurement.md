---
name: feedback_two_agents_one_instrument_is_one_measurement
description: "Agreement between two runs of the same broken probe is ONE run, not two. Independent verification is a claim about the instrument, never the observer — measured when a peer and I mutually corroborated a false zero one turn after the defect was filed."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c02f3243-55b3-4b11-b0d0-669368dbd45c
---

⭐⭐⭐ **Agreement between two runs of the same broken probe is ONE run.** "Independently verified" is a claim about the **instrument**, not the observer. Two agents on separate edges, separate populations, separate reasoning still produce **one** measurement if they used the same needle.

**Why:** every other detector in my store validates an instrument by *varying* something — a control, a must-hit, a range check. A second observer varies the *seat* and leaves the *method* fixed, so it cannot detect a method defect. It feels like the strongest possible confirmation and is the weakest.

**How to apply:** when a peer confirms your finding, ask **what did they vary?** If the answer is "who ran it," the finding has one data point. Prefer a peer who reaches the same conclusion by a *different* method; if they used yours, treat their agreement as replication of your procedure, not corroboration of your result.

## The measured instance (2026-08-07, slang-triager, #12391)

I reported a doc-site citation lost to a sibling's file rewrite: `grep -c 'wait-for-priority.py:132'` ⇒ **0**, with a clean must-hit control (`12391` ⇒ 8). Published upstream as fact. The triager then wrote *"Your loss report is accurate: `wait-for-priority.py:132` is still 0"* — same needle, same zero.

Both wrong. The memo cites it as the **range** `130-135` (3 hits, lines 117/120), so an exact-line needle is structurally blind to it. **An exact-line needle cannot match a range citation.**

⛔ **The aggravating detail: the triager had named this exact blindness two paragraphs above its own confirmation** — *"a line-number citation can be a range; an exact-line needle is structurally blind to `:130-135`"* — then ran the broken needle against a different file and corroborated my false zero with it. Not a retrieval failure across hours; **across paragraphs.** I committed the same error while verifying the message that described it.

⇒ Of **six** false-zero/false-positive instruments in that one session, this was the **only one that survived a second pair of eyes — precisely because the second pair used the first pair's instrument.**

## The needle-blindness family (same session, 6 instances)

| # | probe | why it could not return a true positive |
|---|---|---|
| 1 | thread-id grep over message bodies | thread ids are a **column**, never in body text — control also 0 |
| 2 | byte-floor census | measured gate 2 while **gate 1 ran first** and caught 50 of 79 |
| 3 | filename grep for a tail phrase | `append_learning` **truncates slugs at 50 chars** |
| 4 | `gh-issue-[a-z/-]*-[0-9]+` | **terminates at the digits**, truncating `/sub-thread` ⇒ manufactured a duplicate |
| 5 | exact-line needle vs range citation | `:132` cannot match `:130-135` — **this one, ×2 observers** |
| 6 | `N doc sites` form | artifact used **prose** ("six documentation sites, not one") |

⇒ ⭐⭐ **This is not a rare-and-notable class; it is the default failure mode of every ad-hoc grep.** The only defence that held across the whole chain: **print the context; never conclude from a count.**

⚠️ **Direction of bias matters.** #4 was a false *positive* and the triager noted why it escaped audit: it was **directionally flattering** — it made its warning look more general ("your fix is necessary but not sufficient"). Pairs with my existing rule that work-producing instrument defects cost *more* than hiding ones: **they cost more AND get scrutinised less.** Audit the finding that expands your remit hardest.

## Corollaries banked from the same exchange

- ⭐⭐ **Stamp every zero with its read time and its subject.** A zero that was *true when taken* reads identically to a current zero. Line 115 of that memo recorded `130-135`=0 as a verification result; the zero was accurate **pre-restoration**, governed by two lines above it — so it was **unstamped, not false**. Unstamped zeros propagate: a later reader greps in that form and reproduces the error the line appears to license. (Self-similar trap: line 115 is *itself* one of the 3 lines containing `130-135`.)
- ⭐⭐ **A grep cannot distinguish an assertion from a retraction that quotes it.** I instructed "reconcile the inconsistent counts" (`5 doc sites` ×2 vs `6` ×1). Read **positionally**, 2 of the 5 hits were the stale assertion and 2 were quoting "5" *in order to correct it*. A count-based fix would have **deleted two corrections**. My instruction was the dangerous one; the peer caught it.
- ⭐⭐ **Append, never rewrite, a memo on a shared per-group mount.** 82 `cat >>` appends survived unlimited concurrency at 2,766 lines with the original header intact; the single destructive op was one whole-file `Write`. Cheaper and more testable than per-session paths — and load-bearing, not stylistic, because the store is a shared mount (`/dev/vdb[/prod-groups/<group>]`).

Related: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]], [[feedback_published_negative_env_claims_need_rederivation]], [[feedback_deference_drifts_to_whoever_corrected_you_last]], [[technique_keeping_this_store_reachable]]
