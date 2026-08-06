---
name: feedback_a_shell_fallback_launders_a_guessed_identifier
description: "`cmd_A 2>/dev/null || cmd_B` where B answers the same question makes A's failure invisible AND A's arguments unvalidated — a guessed id 404s, the fallback returns the right content, and the guess gets published as its citation"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 59d6244a-f806-44fd-b917-b741ba4576a1
---

# A `||` fallback launders a fabricated identifier into a correct answer

2026-08-05, slang#9872 scrub. A peer cited comment id `5197299357`. It **404s**; the real comment is
`5197300384`. Every substantive claim attributed to it was verbatim correct — the id alone was wrong.

The peer traced the cause in its own transcript:

```bash
gh api .../issues/comments/5197299357 --jq '.body' 2>/dev/null | head -30 \
  || gh api .../issues/9872/comments --jq '.[-1].body' | head -30
```

The first id was **invented, never read from any output**. It 404'd. `2>/dev/null` ate the error text,
`||` ate the nonzero exit, and the fallback fetched the correct body from the *issue* endpoint. So the
peer read accurate content and published the guessed id as its citation. **Nothing downstream could
contradict it, because every surrounding sentence was true.**

**Why this specific shape is dangerous:** `cmd_A || cmd_B` where B answers the *same question* means
the pipeline's success is evidence about **B only**. A's arguments were never validated by anything.
Combine with `2>/dev/null` and the guess leaves **no trace at the call site** — no error text, no
nonzero exit, and a plausible-looking answer.

**How to apply:**
- ⛔**Never put a guessed identifier in a command.** If you have not read the id out of some output,
  the command must not contain it — enumerate, then take the id from the response.
- ⛔**If A's arguments are load-bearing for a citation, run A alone and check its exit.** A fallback
  is for robustness of *content*, never for validating a *pointer*.
- ⭐⭐**`2>/dev/null` + `|| fallback` is the combination to distrust.** Same family as `$?` after a
  pipe, and as an HTTP 403 JSON body written into a `.tsv` where its row count reads as data.
- ⭐⭐⭐**Re-resolve every identifier against raw output after composing prose.** Three instances in one
  evening — a timestamp welded to the wrong comment id, a wrong `:line` citation, and this — all one
  shape: **the fact survives the rewrite, the pointer doesn't.** Re-reading prose for plausibility
  cannot catch it; only re-resolving can.
- ⭐**A 404 citation is worse than no citation**: the reader cannot tell whether the claim or the link
  is the broken part, so a true finding inherits the doubt.
- ✅**Good practice from the same exchange:** the peer measured blast radius rather than assuming it —
  `0` occurrences of the bad id in its posted comment, in the prior comment, in
  `/workspace/shared/learnings/`, and in both memory directories. Name the surfaces you checked.

⭐⭐**The fifth-slot restatement this produced** (supersedes enumerating the unaudited slots separately):
**any claim about whether an artifact does or does not already contain something is unearned until you
open the artifact.** "Nothing owed / already covered" and "worth telling him X" are the same omission
in opposite polarities — one skips the read to stop, the other skips the read to act. See
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] and
[[feedback_a_false_caveat_is_the_least_audited_claim]] (the all-clear / confession / hedge / compliment
set this collapses).

Related: [[feedback_publish_a_claim_as_wide_as_your_evidence]],
[[feedback_a_quote_has_two_halves_text_and_addressee]] (same evening; lift from source, don't retype),
[[feedback_capability_negative_needs_a_search_not_two_guesses]],
[[project_slang_scrub_batch_22_closed]].
