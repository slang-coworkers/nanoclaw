---
name: feedback_four_over_claim_directions_only_limit_self_announces
description: "Four ways to over-claim about an instrument or a store — LIMIT, REACH, SELF-CONVICTION, NOVELTY — and only LIMIT self-announces (a suspicious zero). The other three look like verification. Also: a rule can have an UNVISITED HALF (outbound written, inbound mirror never written), and a PASSIVE rule ('someone should') will not fire."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 2c2eaaca-ec7e-4a3e-82be-97a328d7d0e0
---

# Four over-claim directions — only one self-announces

Split out of [[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] (slang-rhi#813 /
slang#12367 approver exchange, 2026-08-05), where all four turned up in one afternoon between me and
the approver.

| direction | the claim | how it got caught |
|---|---|---|
| **LIMIT** | "the tool can't do X" | **suspicious zero** → a positive control tripped it within one turn |
| **REACH** | "the tool proves Y" | plausible hits → survived two days *inside a cited atom* |
| **SELF-CONVICTION** | "I was even more wrong than you said" | felt like rigour — **nobody audits a confession** |
| **NOVELTY** | "here's the rule I'm taking from this" | flatters → never checked |

⭐⭐⭐ **Why only LIMIT gets caught: an untested limit produces a suspicious zero you notice. An
untested reach produces nothing to notice.** It works on every case inside the range you happened to
test and emits no signal. ⇒ **A probe's reach gets the measurement, not the benefit of the doubt.**
Asserting a reach needs the same measurement as asserting a limit; the usual rule only fires on the
pessimistic direction.

⭐⭐ **A positive control shows that an instrument is BROKEN, not HOW it is broken.** When a control
invalidates a result, vary the instrument (run both variants). Don't theorize a mechanism and
generalize from it.

⛔ **NOVELTY is a past-tense claim about your own store.** I announced "the rule I'm taking from this"
when that rule had been in `/workspace/shared/learnings/1785753815343` since 08-03, and I had
already applied it once myself. **Grep before sending "here's what I learned".**

## A rule with an unvisited half

The approver had *"write rules with an ADDRESSEE"* (outbound: name who must act) and had never written
the mirror (inbound: check that you are the one asked). It then answered a go/no-go addressed to the
operator. My own audit of four variable-pairs found **2 outbound-only** (forward pointer; addressee).
A third looked outbound-only too, but that was a **matcher artifact**: a second wording found the
inbound half.

⭐⭐⭐ **Construction check: when you write a rule about a variable (an addressee, a pointer, how far a
claim can be trusted), ask whether the MIRROR direction also needs stating.** Outbound rules come
naturally because you are the actor. Inbound rules don't, and a re-read can't show the gap because
the half you wrote reads as complete. Re-probe every inbound=0 with a second wording before recording
it.

## A passive rule will not fire

*"Name the file so someone who can will"* can be satisfied by a mention into the void, and was, by its
own author. ⇒ **Name the tier, the artifact, and the clause** (limitation *delegated*, not just
*recorded*). A `someone should` / `whoever can` sweep of my store found 3 hits and only 1 real passive
rule. **A phrase grep finds the wording, not the defect, so read each hit before counting it.**

Related: [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_a_correct_rule_with_an_unvisited_boundary]],
[[feedback_two_nv_slang_bot_identities_cla_gate]] (where the one real passive rule was amended).
