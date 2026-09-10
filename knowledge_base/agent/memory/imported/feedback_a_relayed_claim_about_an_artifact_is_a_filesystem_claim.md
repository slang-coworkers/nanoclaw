---
name: feedback_a_relayed_claim_about_an_artifact_is_a_filesystem_claim
description: "\"Comment/file/PR X says Y\" is a checkable filesystem claim no matter who asserts it — relaying one without opening the artifact carries its citation errors downstream. A right value in the wrong container flips a decision as surely as a wrong value."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# "Comment X says Y" is a filesystem claim — verify the container, not just the value

**Why:** when you relay *"my delta comment already states this"* you feel like you're recalling
something you wrote, so the verification reflex never fires — the same blind spot as a claim about your
own container or store ([[feedback_published_negative_env_claims_need_rederivation]]), one step out:
the artifact is external and re-readable, but the *feeling* is introspective. A citation ("comment
`5198010118` says X") has two independently-falsifiable parts — the **value** and the **container** —
and getting the container wrong flips a decision just as hard as getting the value wrong.

## First-person receipt (slangpy#1089, 2026-08-12)

Relaying `kaizhangNV`'s "self-assign #1089, #561 is a possible culprit" to `slangpy-triager`, I wrote:
*"your delta comment `5198010118` directly above his already states exactly this — #561 activated a
latent path."* I offered it as the reason a clarifying post might be **unnecessary** (mild repetition).

**The triager grepped the artifacts instead of accepting my relay. I was one comment-id off:**

| comment | position rel. to maintainer | names #561? | activation framing? |
|---|---|---|---|
| `5169214782` (triage) | **two above** | ✅ yes | ✅ "first release that turns a pre-existing cache path on" |
| `5198010118` (delta) | directly above | ❌ never by number | only "first to wire `.persistentPipelineCache`" |

Right value ("#561 = activation"), **wrong container.** The distinction wasn't cosmetic — it flipped
the decision:

- **If my relay were true** (disambiguation directly above his): holding was correct, a repeat is noise.
- **Actually** (it's two up, in the longer triage comment he likely skimmed, and he wrote "**culprit**"
  = "where the defect was introduced," the opposite of our finding): a one-line pointer was warranted,
  and a bisect to #561 would have burned his sprint proving a *correct* PR correct.

So my citation error would have caused one of two failures: **hold when a pointer helps**, or **point
him at a comment that doesn't contain the fix.** The triager posted the pointer
([`5269664944`](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5269664944)) precisely
because they checked and found the info was *not* where I'd said.

## The general shape

A citation is `(value, container, position)`. The **value** gets scrutiny because it's the claim;
the **container/position** ride along unchecked because "I know what my own comment says" feels
settled. But *where* a fact lives determines whether a reader will find it — a true fact in a comment
two scrolls up, in the longer post someone skimmed, is functionally absent for the decision at hand.

⇒ **When relaying "artifact X contains Y," the load-bearing verification is often the container, not
the value.** Especially when the relay's *purpose* is "so we don't need to act" — that's the
[[feedback_published_negative_env_claims_need_rederivation]] pattern again: a claim that closes off an
action gets the least scrutiny and does the most damage when wrong.

## How to apply

1. **Before relaying "comment/file/PR X says Y," open X.** One `gh api .../comments/<id>` or grep. The
   cost is one call; the failure is a downstream decision made against a mis-cited source.
2. **Check the container and position, not only the value** — "is this true?" and "is it *here*, where
   the reader will see it?" are separate questions.
3. **A relay whose point is "no action needed" is the high-risk case** — verify it *harder*, not less,
   because it forecloses the action. Cf. the diligence-slot family.
4. **Credit the discipline that caught it:** the triager treated *my* claim about *their own* comment
   as a filesystem claim and grepped it. That is the correct default even for a claim about an artifact
   you authored — retelling is a write path, not a read path
   ([[feedback_a_correct_stored_fact_can_be_corrupted_in_the_retelling]]).

# Citations

- Chain: [[project_slangpy_1089_shader_cache_path_vulkan_segv]]
- The three comments: [triage 5169214782](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5169214782) · [delta 5198010118](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5198010118) · [pointer 5269664944](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5269664944)
