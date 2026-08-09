---
name: feedback_a_recommendation_stated_as_done_is_a_false_public_fact
description: "A sibling posted '(#12432, closed in favour of this one)' on a public issue while #12432 was open — a recommendation rendered in the perfect tense. Under a hook that BLOCKS the close, the bot can only ever recommend, so any past-tense phrasing about a gated action is false by construction. Grep drafts for perfect-tense verbs naming gated actions."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1eeebc25-4a20-4d12-99f0-c47b6ee02c1a
---

# A gated action described in the past tense is a false statement by construction

**Measured 2026-08-08, slang#12431/#12432.** A sibling session posted cmt `5226358379` (13:41:49Z)
opening with:

> Two details from a duplicate filing (**#12432, closed in favour of this one**) that aren't covered
> above:

**#12432 was open and remains open** — verified live: `"state": "open"`, `closed_at: null`,
`comments_count: 0`, `updated_at` still `13:27:09Z` (unchanged from creation, so nothing had touched
it). The comment's two *technical* claims were sound (I verified both). The false part was a
five-word parenthetical.

## Why this specific error is structural, not careless

⭐⭐⭐ **We do not close issues: the standing maintainer rule (szihs, #11719) is *recommend, never
close*** — see [[feedback_github_writes_operator_authorized]]. So for this class of action the
reachable state is "recommended". ⇒ **Any perfect-tense phrasing about it is false at the moment of
writing.** That needs no state check to detect, only a grammar check on my own draft.

⛔ **CORRECTION (same day, peer-refuted then measured on my own edge): I originally wrote "the bot
cannot close an issue at all — `gh issue close` is denied by a PreToolUse hook." That is
UNSUPPORTED.** `slang-triager` enumerated its hook config and found no such gate; I reproduced on my
edge: `/home/node/.claude/settings.json`, **41 hook entries / 25 event types**, and the *only*
`PreToolUse` `Bash` guard is the OneCLI-proxy-URL refusal (it greps
`git remote set-url|config remote.*url` for a `ROUTED_VIA_ONECLI_PROXY` stub). **Zero** matches for
`state=closed` / `state_reason` / `PATCH` / `issues/`. Control: `"hooks"` appears 41× ⇒ the file was
genuinely read. **No hook gates issue-closing.** What does exist (peer's store, fleet-measured on
three edges) is a *command-text write-guard* denying a literal `state=` adjacent to an `issues/N`
path — which would deny naive `gh api .../issues/N -f state=closed`, so the symptom I inferred is
real, but the mechanism I named is not.

⭐⭐⭐ **The load-bearing lesson: I inherited that sentence from my own store
([[feedback_github_writes_operator_authorized]], line 15, dated 2026-07-02) and restated a
month-old environment claim as present-tense capability — in a leaf I authored TODAY — without
probing.** This is exactly the class [[feedback_published_negative_env_claims_need_rederivation]]
exists for: **a capability-negative has no failure signature**, because readers comply by *not
attempting*, which logs nothing. Writing it into a fresh leaf laundered a stale claim into a
current-sounding one.

⚠️ **And the policy reason is strictly better than the capability reason, in both directions:**
(a) if a human ever authorizes a close, believing it hook-blocked stops us from trying; (b) if a
tooling guard were relaxed, a hook-block story would take the policy with it. **Policy alone is
sufficient and survives any tooling change** — so cite policy, never capability, as the reason we
don't close.

The same holds for the other gated actions: `gh pr ready` and `gh pr merge`. *"Flipped to ready"*,
*"merged"*, *"closed as duplicate"* are all unreachable predicates for us.

## Why it is expensive out of proportion to its size

A maintainer reading *"#12432, closed in favour of this one"* concludes the duplicate is **handled**
and does not act. The one action the chain actually needed from a human — closing #12432 — is the one
the sentence talks them out of. ⛔ **A false "done" doesn't just misinform; it consumes the reason to
do the thing.** Same family as
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].

Aggravating factor: under a shared `nv-slang-bot[bot]` identity, a maintainer cannot tell that the
comment asserting the close and the comment recommending it came from **different sessions** — it
reads as one actor contradicting itself
([[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]]).

## Resolution on this instance

`slang-triager`'s verdict (cmt `5226491879`, 14:16:01Z) corrected it **in-line** rather than by
editing a sibling's comment: *"One correction to the earlier comment on this issue: #12432 is still
open as of this writing — it has not been closed, and closing it is a maintainer's call, not ours."*
✅ **Correct handling on three counts:** it repaired the public record, it did not mutate another
tier's artifact, and it restated the ask so the needed human action survives.

## How to apply

- ⭐⭐⭐ **Before posting, grep the draft for perfect-tense verbs attached to gated actions** —
  `closed`, `merged`, `flipped`, `un-drafted`, `marked ready`. For anything the hook blocks, the only
  admissible forms are *"recommend closing"*, *"suggest a maintainer close"*, *"asked for"*. This is a
  **grammar** check on my own text, needing no API call, which is why it is worth making habitual.
- ⭐⭐ **Parentheticals and asides evade the verification pass.** The two load-bearing technical
  paragraphs in that comment were both correct; the error rode in a five-word aside that no
  claim-by-claim review would have listed as a claim. **Cross-references to OTHER artifacts' state are
  claims** — treat `(#N, <anything about #N>)` as a fact requiring a live read.
- ⭐ **When correcting a peer's public inaccuracy, correct in-line in your own artifact.** Don't edit
  theirs, don't ask them to retract, and re-state the human action the false sentence suppressed.
- ✅ **Detector for the reader side:** a cross-reference asserting another issue's terminal state is
  cheap to check — one `github_get_issue`, keyed on `state` + `closed_at` + `updated_at` vs
  `created_at`. If `updated_at == created_at`, nothing has touched it since filing, so no close
  happened.

Instance: [[project_12431_12432_unit_test_assert_empty_output]]. Related:
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]] (the `updated_at`/`created_at`
tell), [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]].
