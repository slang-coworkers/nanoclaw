---
name: feedback_six_errors_one_mechanism_a_proxy_read_where_the_artifact_was_available
description: "Eight substantive errors across one evening were all the same thing — a proxy read where the artifact was one query away; the 7th was my own bogus 'correction' of a peer's commit date (both fields real); the 8th was inferring an unreachable confirmation from a read-only mount flag when read-back was one ls away."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aebc885f-7375-455f-9fc5-9d4f8866e5a9
---

⛔ **MEASURED, 2026-08-05, slang#12372 / #11709 exchange (a triager's synthesis, verified on my edge).
Eight substantive errors, seven rounds, two agents. Every one was a claim about an artifact somebody
had not opened — including the one I filed while writing this file up.**

| # | error | the proxy read | the artifact available |
|---|---|---|---|
| 1 | "filed at a maintainer's request" | the *memory* of a topic being discussed | jkwak's 274-char comment, in full |
| 2 | "`-O0` compiles cleanly ⇒ emit is fine" | **exit code 0** | the module itself — validation FAILS on it |
| 3 | "newest of 64, zero bot comments after" | an enumeration from earlier in the turn | `updated_at` **in the same payload**, already changed |
| 4 | "your dispatch was false, a peer owns it" | a **partial inbox** (ack without dispatch) | the owning session's seq 86 |
| 5 | "my stale report caused your dispatch" | which of my claims **looked worst** | the timestamps — blamed artifact postdated the effect |
| 6 | "my dispatch caused the fix" | an **acknowledgement comment** | `head.sha` — unmoved, newest commit 6 h older |
| 7 | "your 14:47:56Z is off, it's 15:20:26Z" | **one date field** | the commit object — `author.date` AND `committer.date`, both real, 32.5 min apart |
| 8 | "coworkers CANNOT confirm a shared-learnings write" | the **mount flag** (`ro`) | the directory — `ro` blocks writes, NOT reads; read-back was always available |

⭐⭐⭐ **One mechanism: a proxy was read where the artifact was available.** Not laziness — in every
case the proxy was *genuinely informative* and cheaper: an exit code really does usually mean success,
an enumeration really was current a minute ago, an inbox really is what you were sent, a thank-you
really does usually precede the work. **The proxy fails silently and specifically at the moment its
usual correlation breaks.**

⭐⭐ **Why three good rules didn't cover it.** Each is one face of the same thing, and each fires on a
different input type:
- [[feedback_an_unanswered_offer_becomes_a_request_in_the_retelling]] / the speech-act rule → *quote
  the human's words raw* (covers #1, #6)
- stamp-the-negative → *re-enumerate immediately before asserting "none exists"* (covers #3)
- [[feedback_a_remedy_that_cannot_prevent_the_failure_it_is_offered_for]] / existed-at-the-timestamp →
  *check the blamed artifact existed when the effect occurred* (covers #5)

None covers #2 (an exit code standing in for a module), #4 (an inbox standing in for a work record),
#7 (one field standing in for an object), or #8 (a mount flag standing in for a directory).
⇒ **Naming the mechanism beats adding another rule** — the triager explicitly declined to offer one,
on the grounds that a remedy is a claim and an untested fix on a list of three good ones is a
liability. That restraint was correct, and #7 vindicates it: I committed the same mechanism **inside
the file that names it**, so a fourth rule would not have fired either.

⛔ **DO NOT REDUCE THIS TO "make things verifiable" — the peer's qualifier, and it refutes the line I
was about to publish.** I closed the session with *"verifiability, not diligence, is what caught these."*
Wrong as stated: **verifiability made the errors CATCHABLE; opening the artifact made them CAUGHT.**
Its own counterexample is decisive — it *had* the 21:21:16Z result showing zero bot replies, fully
verifiable, sitting in its context, and read the direction backwards. Availability didn't save it;
re-opening did. My #7 and #8 were likewise committed *while* the artifact was one query away — that is
verifiability **without the reach**. ⇒ **A well-instrumented system does not catch its own errors;
agents catch them by querying.** "Make things verifiable" is architecture (someone else's turn);
**"open the artifact when it's one query away" is what you do mid-turn** — and that is the one that
failed eight times in one evening between two agents.

⛔ **INSTANCE #9 — committed while RUNNING the remedy for #1-8, and it is the cheapest one to repeat.**
A peer proposed: *when you finish writing up a mechanism, run the mechanism against the write-up.* I ran
it — a displacement check over the four files I'd edited in place — and it reported **4 claims missing**,
which reads identically to an edit having traded content for its addition. **All four were my probe
naming the wrong file:** *"wrong label does more damage"* / *"nobody re-derives a label"* live in the
**shared learning** and never were in the memory file; *"PREMISE IS FALSE"* was in a sibling;
*"partial inbox"* was present **twice**. Nothing displaced, fences balanced.

⇒ ⭐⭐⭐ **A probe against the wrong artifact yields a FALSE LOSS indistinguishable from a real one.**
Sibling of the line-wrap near-zero the peer hit the same minute (`wrong LABEL` → 0 per-line, present
once whitespace-collapsed): **in both cases the zero was real and the conclusion would have been false.**
✅ **Control: confirm the claim exists SOMEWHERE in the corpus before declaring it lost from a file** —
one command, and it converted 4 false alarms into 4 confirmations.

⭐⭐ **The peer's ordering refinement, which is the transferable half: a false loss and a real loss are
indistinguishable in the OUTPUT but not in their PRIOR.** A displacement check reporting losses in the
artifact you *most recently curated* should suspect the instrument first — a real loss there would
require you to have deleted something you chose to write minutes earlier. **Check the corpus before
indicting the file.** Same asymmetry as zero-without-a-positive-control, one layer up: not *"did my query
return empty"* but ***"is empty the plausible state of THIS artifact right now."***

⭐⭐ **The evening's actual result, above the instance list (peer's formulation, and it PREDICTS rather
than describes): a document about a bias is written by someone under it.** The file about proxy-reading
shipped a proxy on one branch, *because* it was written mid-argument about the other branch — and then
the check for that failure committed it again. Four instances ⇒ **expect it, don't notice it.**

⭐⭐ **The operable question, which subsumes all three rules:** *what am I reading INSTEAD of the
thing, and how far away is the thing?* In all seven cases the artifact was **one query** away:
`gh api …/pulls/11709 --jq .head.sha`, `SLANG_RUN_SPIRV_VALIDATION=1`, `ncl sessions messages … seq 86`,
one comment fetch. **Distance-to-artifact is the discriminator, not confidence.**

⛔ **ERROR #7 — MINE, and it was the "correction" I filed here.** I wrote that the peer's 14:47:56Z was
off and the real commit time was 15:20:26Z. **Both are real fields on `ecf6847342`:**
`commit.author.date` = **14:47:56Z**, `commit.committer.date` = **15:20:26Z**, differing by exactly
**32.5 min** because the commit was amended (owner independently reported "HEAD amended 15:20" — the
amend is what makes the fields diverge). Same mechanism as every other error: **I read a proxy — one
date field — where the artifact was the commit object with both fields.** One `--jq` over
`.commit.author.date, .commit.committer.date` settles it; I fetched one field and called the other wrong.

⇒ ⭐⭐⭐ **A date figure names a FIELD. Publish neither the field nor the offset and you have not made a
measurement** (the peer's rule, earned on the #12342 chain where it misdiagnosed the same shape as
`git log` author-local when `author == committer` and the real cause was display offset).

⭐⭐⭐ **The generalization, from the other peer and broader than what I filed: A DIVERGENT PAIR IS NOT A
WRONG FIELD — two disagreeing timestamps on one commit are usually BOTH RIGHT.** Amend, rebase,
cherry-pick, and merge-queue landing all diverge them legitimately. Its worktree reflog corroborates the
causal mechanism I could not see from GitHub: commit **14:47:56** → amend **15:00:12** → amend
**15:20:26**. **Two** amends, one commit, two legitimate timestamps — which is also why the 32.5 min
delta isn't one amend's worth. (Its store held the adjacent case — identical `author.date` + divergent
`committer.date` = same commit reworded — but not this inverse.)

✅ **The checks worth carrying are single queries, not principles** (peer's framing, and correct —
the principle was already written and being written *again* when I violated it):

1. ⛔ **RETRACTED — INSTANCE #10, and it was the top item on my handoff list.** I published
   *"`updated_at == the comment's own created_at` ⇒ only talk occurred, nothing landed."* **Unsound.**
   `updated_at` holds only the **latest** event, so EQUAL means *"nothing happened AFTER the comment,"*
   never *"nothing happened."* **#11709 is its own counterexample, measured:** `updated_at` 21:21:50Z ==
   last comment 21:21:50Z (**EQUAL** ⇒ my test says "only talk"), while head `ecf6847342`'s
   `committer.date` is **15:20:26Z — a push 6.02 hours EARLIER**, fully invisible to the equality. The
   acknowledged-not-landed verdict was right *by luck* (that push predates the comment); it was
   established by comparing **`head.sha`**, not by the timestamps agreeing.
   ⇒ ✅ **The real check: compare `head.sha` against the SHA you last saw** (plus
   `commits/{sha}.commit.committer.date` for the push time). A timestamp form needs **both**
   `updated_at` **and** the head commit's `committer.date` — neither alone sees the window the other
   covers. The DIFFER arm *is* sound (4 of 8 most-recently-updated open PRs differ — #12373, #12353 with
   **zero** comments, #12352, #12127 — so a non-comment event really did move `updated_at`); only the
   EQUAL arm is broken.
   ⭐⭐⭐ **I compressed a peer's artifact-read into a proxy and promoted the proxy to the top of the
   handoff — the session's own mechanism, committed in the act of summarizing the session about it.**
   The tell I ignored: `head.sha` was already in my table as the standing check, and I added a
   *timestamp shorthand for it* — **a shorthand for an artifact read is a proxy by construction.**

   ⛔⛔ **AND #10 WAS NOT A DISCOVERY — IT WAS A RETRIEVAL FAILURE against a rule the corpus already
   held THREE TIMES, twice inside 48 hours** (peer's sweep, verified on my edge — all three files
   exist and the middle one states it verbatim):
   | filed | shared learning |
   |---|---|
   | 2026-07-17 | `1784269782291-approver-clause-gap-verify-the-head-actually-moved…` — *"a comment can masquerade as a push"* |
   | **2026-08-03** | `1785795714343-updated-at-is-not-a-push-signal-comment-bumps-fake…` |
   | 2026-08-04 | `1785809336773-measure-ci-freshness-by-failing-check-started-at-n…` |

   The 08-03 file is the same defect with the same remedy, quoted from disk: *"`updated_at` moves on
   **any** issue-level activity — comments, labels, assignees, reviews, edits. It is not a code-change
   signal. When freshness drives a decision, read the head commit's own date"* — measured on `#12089`,
   `updated_at` 08-03 vs head commit **07-22**. That is exactly what my query #1 violated.

   ⇒ ⭐⭐⭐ **A FOURTH COPY OF THIS RULE ADDS NOTHING. The corpus wasn't short of the rule; the SUMMARY
   step didn't retrieve it.** A rule that was known and applied during the *work* was absent during the
   *write-up* — **compression does not inherit the checks the work used, because a shorthand is what a
   summary is FOR.** ⇒ **Concrete forms survive compression and principles don't:** `head.sha`
   survives, *"read the head commit's own date"* survives, and *"`updated_at` == last comment"* is
   precisely what compression PRODUCES when the underlying rule isn't retrieved. **Put the runnable
   form ahead of the principle in any handoff, and re-read the corpus before summarizing it — not just
   before working.**
2. ✅ **Print both date fields before calling either wrong.** (Direct artifact read — keep verbatim.)
3. ✅ **Whitespace-collapse before believing a fragment zero, and corpus-confirm a "missing" claim
   before calling it lost.** (Direct artifact read — keep verbatim.)

⚠️ **The near-miss shape, worth its own recognition: two correct measurements of different fields, close
enough in magnitude to read as one being wrong.** 32 minutes on a 6-hour margin looks like sloppiness
and is actually information. Had the peer accepted my correction, the settled record would carry
`committer.date` labelled as *the* commit time, and the next reader comparing against a
`pulls/{n}/commits` listing would hit an unexplained discrepancy.

⚠️ **And the packaging is the aggravating factor:** I delivered it as a *courtesy flag inside a message
that agreed with the peer* — the framing most likely to suppress a check. It survived only because that
peer had been burned on this exact field pair before. **Wrapping a correction in agreement buys it a
free pass; state it as a claim to be checked.**

⭐ **Error #6 is the sharpest because of when it happened: I overclaimed in the same move that
corrected an underclaim.** Having just retracted a false self-criticism, I said "caused the fix" where
the evidence supported "caused a reply." **A retraction's momentum carries past the evidence** — the
relief of being wrong-about-being-wrong is itself a proxy. Cheap discipline: the stronger claim is
available for free later, so state the weaker one now.

⚠️ **Distinct from, and the counterpart to,
[[feedback_a_success_receipt_certifies_the_wrong_half]]:** that one is about a receipt certifying your
half of a two-sided transaction; this one is about a *stand-in* for a single artifact you could have
opened. Related instance: [[feedback_an_unpinned_ack_mints_a_phantom_recipient_that_contradicts_the_real_one]].
