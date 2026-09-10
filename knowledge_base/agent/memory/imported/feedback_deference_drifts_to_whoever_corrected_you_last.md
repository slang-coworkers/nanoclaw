---
name: feedback_deference_drifts_to_whoever_corrected_you_last
description: "After several rounds of being corrected, a peer's figures become authority and your own become draft — measured 2026-08-05 on slang#9872: I published a peer's '7 of 8' into a public comment while my OWN audit output on screen already read '8 of 10' (correct). Deference silently DISCARDS a correct measurement for a wrong one. Re-read your own output before adopting a corrector's number."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9872-scrub-redrive
---

# Deference drifts to whoever corrected you last

2026-08-05, slang#9872, after **four** rounds in which a peer correctly caught my errors (false zeros,
a wrong provenance cite, mixed units, an overclaimed control). On round five it sent a doc-density
figure of **7 of 8**. I published that into a maintainer-facing GitHub comment.

⛔ **My own audit, run two messages earlier and still in my context, printed
`==> blocks documenting FUNCTIONS: 8` and listed all ten function definitions.** The correct figure —
**8 of 10** — was already on my screen, computed by me, when I typed theirs. The peer then had to
correct its own number back to mine.

## Why this is worse than ordinary error

⭐⭐⭐ **It silently discards a CORRECT measurement in favour of a wrong one.** Every other failure on
this chain replaced *nothing* with something wrong. This replaced *something right* with something
wrong — so the work had already been done and the defect was purely one of authority-assignment.

⭐⭐ **The correction reflex becomes its own bias.** Being right about my errors four times running
made the peer's output feel *pre-verified* and my own feel provisional. Nothing about that shift was
deliberate or noticeable; it reads as appropriate humility, which is exactly the disguise the
plausibility failures on this chain wore ([[feedback_a_plausible_story_disarms_the_implausibility_alarm]],
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]]).

⭐⭐ **It is the mirror of credit-drift.** In
[[technique_git_log_S_in_a_shallow_clone_returns_a_false_origin]] *credit* drifted to whoever last
relayed a fact; here *authority* drifts to whoever last corrected you. Same mechanism — provenance
reassigned by recency — with the sign flipped and a worse outcome, because credit-drift misattributes
a true fact while this one propagates a false one.

## The companion half, from the peer

⭐⭐⭐ **Fixing a diagnosis does not fix the counts derived from it — nor the counts your COUNTERPARTY
derived from it.** The peer diagnosed its regex's generic-blindness (a pattern requiring
`<ident> <ident>(`, blind to `foo<T>(`), then two messages later quoted `8` and `11` from that same
broken probe. I propagated the 8. **One defective instrument, two tiers, four rounds.** ⇒ After
diagnosing an instrument defect, **re-derive every number that instrument ever produced**, and tell the
counterparty which of your published figures are now void — a diagnosis announced without a recount is
an invitation for the other tier to keep quoting the bad number.

## How to apply

- ⛔ **Before adopting a corrector's figure, re-read your own output for the same quantity.** If you
  measured it, your measurement is evidence; their correctness on *other* claims is not evidence about
  *this* one.
- ⭐ **State whose measurement you are publishing.** "Their 7 of 8" vs "my 8 of 10" makes the conflict
  visible on the page; an unattributed number hides that two sources disagreed.
- ⭐⭐ **Track correctness per-claim, not per-agent.** A peer with a 4/4 record still has an
  instrument, and this chain's whole lesson is that instruments fail clean, confident, and singular.
- ⭐⭐⭐ **SECOND AXIS, from a peer 2026-08-06 — the same drift fires from the OPPOSITE starting
  condition.** Mine came from a corrector who had been right 4×; theirs came from having *just been
  caught fabricating*, which made its instinct to concede the next challenge instantly. It measured
  instead, and **both line numbers were right against different trees** (`slang-diagnostics.lua`
  `:5930` master / `:5923` branch; I verified the STATES: 6171 vs 6164 lines, block present/absent).
  ⛔**BUT THE CAUSE I "VERIFIED" WAS BACKWARDS AND I PUBLISHED IT AS FACT** — see
  [[feedback_a_diff_marker_describes_a_state_not_an_action]]: master **GAINED** those 7 lines in
  `0286a2c3d5` (08-06T07:42Z, `slang-diagnostics.lua +7 −0`); the branch never deleted anything, it
  merely predates the addition. I read `<` lines from `diff master branch` as *"the branch deletes
  these"* and handed the peer's own wrong causal story back as independent confirmation.
  ⇒ **One confirmed error of yours does not make the next challenge correct.** Conceding would have
  put a WRONG line into the PR body *and thanked the reviewer for it* — the correction introducing the
  defect. Both directions collapse to the same rule, which is why the rule is not about either
  party's track record. ⚠️Also: a `file:line` citation can go stale from an edit **nowhere near the
  cited code**, so *"did my change touch this file?"* answers *no*, correctly, and is useless — cite
  by **symbol name**, the thing that survives an unrelated edit above it.
- ✅ **What worked: recounting from scratch when told the figure was wrong** — that reproduced 8 of 10
  independently and *also* revealed I'd already had it. The recount is what surfaced the deference,
  not the correction itself.

## Sibling instrument notes from the same exchange (kept here because they surfaced together)

- ⭐⭐ **`find()` on a pattern that has become non-unique silently answers about the wrong instance.**
  My clause-position check returned False for three figures that were in fact correctly placed: the
  comment had grown a *second* `*(Corrected: …)*` clause and `find()` matched the first. Fix:
  `finditer` and select the intended span. ⇒ **It surfaced only because a PREVIOUSLY-PASSING check
  flipped** — a check that starts failing is information, not noise. Same gift as an **out-of-range
  result**: on this chain a plausible `19×` survived two tiers and three rounds of mutual verification,
  while an impossible `125%` (a fraction over 100) died in seconds. ⭐⭐⭐ **Plausibility is what let the
  wrong number live** — so build a range check into any derived figure, because absurdity is a faster
  detector than agreement.
- ⚠️ **Right by accident is not right.** My doc-block classifier skips lines starting with `//` or `[`
  when walking from a block to its target, so a commented-out attribute
  (`// [require(cpp_cuda_metal_spirv)]`) between a `/**` and its function was stepped over rather than
  reasoned about. Correct output, unearned — it would fail silently on a different intervening line.
- ⭐⭐ **Enumerating six spellings of ONE notation class is n=1 on the dimension that matters.** The
  peer's false all-clear swept `2/39`, `2 / 39`, `10/10`, `10 / 10`, … — all slash forms — against a
  comment that said `**2 of 39**` in prose. **Variant-count felt like thoroughness while coverage
  stayed in one notation class**, and its must-hit control fired correctly the whole time. ⇒
  [[feedback_a_null_tells_you_about_your_question_before_the_world]]; a must-hit control validates the
  INSTRUMENT, never the TARGET.

Related: [[project_9872_neural_hlsl_never_a_target]] (the chain, and the published figures' history),
[[feedback_a_null_tells_you_about_your_question_before_the_world]],
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]] (why a sibling's unchecked claim
becomes yours), [[feedback_a_remedy_that_can_reproduce_its_own_bug]].

## THE SENDING SIDE — I am usually the corrector, and a correction is the lowest-scrutiny shape

⛔ **2026-08-09. This leaf's rule is about DEFERRING to a corrector. The mirror was uncovered and it
is the side I actually occupy: across one day I issued ~15 corrections to one coworker. A correction
arrives with the highest authority and draws the least scrutiny of any message shape** — specific,
actionable, and apparently already-verified. The peer named it: *"the incentives all pointed at
editing."*

⭐⭐⭐ **The concrete near-miss: I quoted a sentence from the peer's CHAT MESSAGE and told it "the
stored version is …", instructing it to repair a leaf on ITS filesystem.** The sentence was not in its
store. Only its grep of 147 leaves caught it. Had it complied, it would have **invented a stored rule
and then cited it as pre-existing** — an artifact worse than the original defect, because it is
self-consistent and undetectable later. A fabrication authored by the recipient at my instruction.

**Why:** *correct the stored rule* and *add a rule that was never there* are different operations. I
had no way to see the artifact and asserted its contents anyway — the same cross-edge error as
ANCHOR C, but about **PROVENANCE rather than VALUE**: a peer stating X in conversation is not evidence
X is in their store.

✅ **Guard, free, both directions:**
- **Sending** — describe what I OBSERVED, never where I assume it lives: *"the version you stated at
  01:20Z"*, never *"your stored rule."* Same information, no claim about their filesystem, and it puts
  the provenance question where they can answer it.
- **Receiving** — when a peer describes the contents of MY file, grep the quoted string before
  editing; absent ⇒ say so and treat the instruction as NEW, not as a correction.

⚠️ **The asymmetry is structural, not personal.** In an orchestrator↔coworker pair I am the frequent
corrector, so every one of my errors ships in the low-scrutiny slot, and the recipient's compliance is
the predictable outcome — not their lapse. ⇒ **the burden of verification sits with the corrector, in
proportion to how often the corrections are right.** Being right ~15 times is exactly what makes the
16th dangerous. See also [[feedback_cheap_to_verify_became_substitute_for_verified]] (same day: I
relayed a peer's headline because checking it looked easy) and the receiving-side rule above this
section.
