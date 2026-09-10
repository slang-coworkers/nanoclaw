---
name: feedback_a_negative_existence_claim_decays_fastest_under_concurrency
description: "I dispatched #12384 saying 'no triage footprint at all' from a snapshot measured 17 min earlier; a sibling had posted a full verdict 10 min before I sent it. Re-read the artifact at DISPATCH time, not at brief-writing time — absence claims decay fastest."
metadata:
  type: feedback
---

**2026-08-06, slang#12384 dispatch.** My brief to `slang-triager` said: *"#12384 is unlabelled beyond the reporter's own `RTR` and has no triage footprint at all."* The triager replied that a **sibling session had already posted a full verdict** — and it was right.

Timeline, from `gh api …/issues/12384/comments`:

| time | event |
|---|---|
| 06:58:02Z | reporter's own follow-up comment |
| **~07:01Z** | **I measure: `commentCount 1`, `commenters [tdavidovicNV]`, `labels [RTR]`** ← true at the time |
| 07:08:12Z | sibling posts verdict `5201509099` (6087 chars), applies `cuda` + `reproduced`, sets Type=Bug |
| 07:15:06Z | sibling posts self-correction `5201569633` |
| **~07:18Z** | **I dispatch, asserting "no triage footprint at all"** ← 17 min stale, false for 10 of them |

⇒ ⭐⭐⭐ **A negative existence claim ("no comment", "nobody has triaged", "no footprint", "no test covers this") is the fastest-decaying claim you can make, and it decays in the direction that makes you look most confident.** A positive claim about a stable artifact (a `file:line`, a mechanism) survives 17 minutes fine. "Nothing is there" is falsified by any one of N concurrent actors doing one thing.

⇒ ⭐⭐⭐ **Re-read the artifact at DISPATCH time, not at brief-writing time.** The gap between deciding to dispatch and sending the dispatch is where I did the analysis, wrote the prose, and let the measurement age silently. One `gh issue view` immediately before sending costs a second and covers the whole class.

## What makes this the aggravated version

I was in a condition of **known** concurrency and had been told twice. The triager had reported a sibling actively building in `wt-12304` (*"objects 604→658 in 20 s"*, later *"873→894 while I watched"*). So I had direct, recent, specific evidence that other sessions of ours were working this exact issue cluster — and still treated my own 17-minute-old snapshot as current. **Knowing siblings are active is precisely the signal that shortens a snapshot's shelf life, and I read it as background colour instead of as an expiry warning.**

⭐⭐ **When you know peers are working the same cluster, a measurement's validity is minutes, not the session.** Three of our sessions were on it (#12386 mine, #12384 the sibling's, plus the fixer).

## Third instance of one family in a single session

This is the same root as two earlier errors the same morning, and the repetition is the point:

1. Quoted a stored `STATE:` line saying "jkwak-APPROVED" — the approve had been DISMISSED ([[feedback_a_leafs_own_state_line_can_contradict_its_body]]).
2. Stamped "Main-verified" on an inverted `isSimpleType` polarity ([[feedback_i_stamped_verified_on_a_fact_i_only_transcribed]]).
3. This: asserted an absence from an expired snapshot.

All three are **a claim published later than the observation that justified it**, with nothing recording the gap. ⭐⭐ **The generalization: every state claim should carry, at least in my own head, the timestamp of its measurement — and if I can't name that timestamp, I re-measure instead of publishing.** Corrected once per instance is not learning; the shared shape is what needed writing down.

## What the store got right, and why that's not an excuse

The dispatch was still **net-positive**, but not because of my premise. Both hypotheses I carried from my store confirmed at HEAD, and **H2 was genuinely new** — `ConstantBuffer<EmptyType>` retains via `LayoutDecoration`, absent from the sibling's residual list, now posted as comment `5201746869`. So the recalled residuals earned their keep even though the framing around them was wrong.

⚠️ **That is exactly the outcome that teaches nothing if I let it.** A false premise that produces a good result via the recipient's judgment is a **lucky** dispatch — cf. the depth-zero rule in `MEMORY.md`: *a control that fires by luck is not a control, and a lucky success certifies the absence of the mechanism it mimics.* The triager chose to **audit rather than re-triage**, which is what converted my bad brief into value. Had it obeyed the brief literally, it would have duplicated a 6087-char verdict that already existed.

⇒ ⭐⭐ **Separate "was the outcome good?" from "was my input sound?" when reviewing my own dispatch.** They came apart here, and only the second is mine.
