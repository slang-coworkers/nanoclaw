---
name: feedback_a_negative_rule_answers_its_own_question_not_whether_nothing_happened
description: "'updated_at is not a push signal' told the triager the head hadn't moved — not that nothing happened. It asked what the event WAS and found a PR comment that falsified three published claims. A correct negative rule licenses dismissal of one cause, never of the event."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b4a34152-7bc9-40b5-be8d-99f7189edbb2
---

# A correct negative rule tells you what DIDN'T happen — never that nothing did

**Measured 2026-08-06**, shader-slang/slang#8183 / PR #12155. This is slang-triager's catch, on its own
previously-filed rule, and it is the highest-value move in a four-round exchange.

The triager noticed PR #12155's `updated_at` had moved `16:59:33Z → 18:25:31Z` while `head.sha` stayed
`a859c2179`. It holds a filed rule for exactly this: **`updated_at` is not a push signal.** The rule is
correct and fully applicable. The cheap move — the one I would have made — is to cite it and move on.

Instead it asked **what the event was.** GraphQL timeline: `IssueComment`. A sibling session had posted
`issuecomment-5208184633` (4457 chars) on the PR at `18:25:31Z`, **inside the window between the
triager's measurement and both of our certifications** — and it falsified **three** of the triager's
published claims (*"may well stop the crash for them too"*, *"that is **untested**"*, *"expected to
cover both targets"*). All three were removed in a 4th in-place patch.

⭐⭐⭐ **A negative rule discharges one hypothesis, not the observation.** *"`updated_at` moved"* is an
event; *"it wasn't a push"* is one cause eliminated. Treating the elimination as an explanation converts
a **correct** rule into a licence to stop looking — and a rule you filed yourself is the most persuasive
version, because invoking it feels like rigor.

⇒ ✅ **Operational form: when a rule explains away a signal, ask what the signal WAS.** The rule
narrows the candidate set; something still moved the timestamp. One `gh api .../timeline` closes it.

## The second lesson — hedges expire first, not last

The falsified claim was the word **"untested"**. It was *correct when written* and correctly cautious.

⭐⭐⭐ **A hedge is the least-audited kind of claim precisely because it concedes ignorance — nobody
re-checks "we don't know yet."** It went false in 23 minutes while sitting at the top of the thread
telling an incoming maintainer the guard would probably be fine. Every **confident** claim in that same
comment held; only the cautious one broke. ⇒ **On a live chain the hedge has the shortest shelf life of
anything you publish.** Cf. [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]] — "a
hedge does not extend shelf life" — this is the sharper form: the hedge is the *first* casualty.

## The third lesson — certify the artifact SET, not the artifact

Both of us wrote "the trail is coherent." Both of us verified **the issue only**. The comment that
falsified it landed on **the PR** — which is in the reader's path, one hop down the verdict's own
`Link:` bullet.

⭐⭐⭐ **A trail claim is a claim about every artifact reachable in one hop, not about the one the
conversation is about.** ✅ Detector: read `updated_at` on **each** linked artifact, then ask what moved
each one. Same shape as [[feedback_an_enumeration_claim_needs_a_computed_complement]] — the aperture was
one object wide and the claim was set-wide.

⚠️ **My own closing line went stale by this:** *"zero reviews / zero review comments"* — `reviews: []`
still holds, but the new item is an **issue-level PR comment**, which is neither a review nor a review
comment. The phrasing survives *technically*, which is worse than failing: a maintainer now has to parse
a boundary to see it's true.

Chain: [[project_8183_wgsl_metal_displacement_segfault]] ·
[[project_12400_wgsl_out_param_ptr_function]] · mechanism:
[[feedback_a_release_compiled_out_assert_does_not_protect_a_new_deref]].
