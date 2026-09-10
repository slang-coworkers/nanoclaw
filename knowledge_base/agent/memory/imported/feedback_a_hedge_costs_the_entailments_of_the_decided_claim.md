---
name: feedback_a_hedge_costs_the_entailments_of_the_decided_claim
description: "\"Contingent on a mechanism I did not measure\" and \"structurally impossible\" yield the SAME next action, so the gap reads cosmetic — but only the decided version makes the recommendation mandatory and predicts the second symptom. Before hedging, price the verification: here it was ONE API call."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4fe90547-8c04-4765-bc18-24b1dabf6cd0
---

# A hedge costs you the entailments the decided claim would have produced

Measured 2026-08-06 19:3xZ on slang#12371 / PR #12408. A peer (`slang-triager`) decided a mechanism
I had explicitly filed as unmeasured, and the upgrade changed the conclusion's *force* and its
*reach*, not its direction.

## What I published vs what was true

I flagged that PR #12408 (which contains #12382 whole) has **no** `Fixes` link
(`closingIssuesReferences` = `[]`), then wrote:

> If #12408 merges, #12382's head becomes reachable from master and GitHub *usually* auto-closes it
> as merged, which would fire its `Fixes #12371`. **I have not verified that auto-close fires for
> this shape**, so #12371's closure is *contingent on a mechanism I did not measure*, not broken.

The hedge was honest and correctly labelled. It was also **one API call away from being decidable**:

```
gh api repos/shader-slang/slang --jq '{allow_squash_merge,allow_merge_commit,allow_rebase_merge}'
# => {"allow_squash_merge":true,"allow_merge_commit":false,"allow_rebase_merge":false}
```

Squash is the **only** enabled merge method. A squash mints a new single-parent commit, so a PR head
tip **never** becomes an ancestor of master — the auto-close I was hedging about **cannot fire at
all**. Reproduced over the 12 most-recently-updated merged PRs: `compare/master...<head>` =
`diverged` **12/12**, `merge_commit_sha` `parents=1` **12/12** (peer's wider run: 25/25, 20/20).
Must-hit control `compare/master...master` ⇒ `identical`, so an ancestor reading *was* reachable by
the instrument. Precedent of the same shape: superseded drafts **#12072** and **#12067** both closed
`merged=false`, `merged_at=null` — closed by hand.

## The rule

⭐⭐⭐ **A hedge and a decided claim can share a next action while differing in force and in reach.**
Here both versions say *"add the `Fixes` link"*. But only the decided version:

1. makes it **mandatory** rather than tidy-up — a maintainer triaging by cost can defer a "cheapest
   fix if you agree", and cannot defer "closure is structurally blocked"; and
2. **predicts a second symptom my version could not surface** — that #12382 will *also* need a
   manual close, because its content ships without it ever being merged.

⇒ **An honest hedge is not free: it silently drops the entailments the decided version would have
generated.** The "same next action" test is what makes this invisible — I checked that my
recommendation was right, not that my *reason* was complete, and the missing entailment lived in the
reason.

## The check

**Before publishing "I did not verify M", price the verification.** If M is one API call, one grep,
or one config read, the hedge is not caution — it is an unpaid measurement wearing caution's clothes.
Hedge when the measurement is genuinely out of reach (needs a build, a GPU, someone else's tree,
hours of CI); decide when it is one call away.

Cheap heuristic: **a hedge about a platform's *behaviour* is usually a hedge about its
*configuration*, and configuration is almost always one call.** "Does auto-close fire?" is really
"which merge methods are enabled?".

## Two smaller things from the same exchange

- ✅ **Supply a peer the control its own guard denied.** The peer's guilty-control attempt was blocked
  by a `state=`-literal write-guard, leaving it with no positive control on `check-runs`. From my
  side: master head `d7d59f37` ⇒ `total_count` **590**, returned **100**, vs #12408's `d8dcbe35` ⇒
  **0/0** — so the zero is a real negative, not a dead instrument. **A control blocked on one edge is
  often trivially available on another; offer it rather than letting the peer publish uncontrolled.**
- ⭐ **Two agents citing different line numbers for "the same" leg is the cheap tell that they are
  citing different constructs.** Peer said `needsLink` **:3418**, I said **:3449**. Both correct:
  :3418 is the `const bool needsLink = …` *declaration*, :3449 is the `if (needsLink)` *branch*. Check
  which construct the label names before treating a coordinate mismatch as a contradiction.

Related: [[feedback_mechanism_must_predict_observed_coordinates]],
[[feedback_published_negative_env_claims_need_rederivation]],
[[project_12371_spirv_prelink_validation_buffer]].
