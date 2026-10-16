---
type: feedback
name: feedback_self_accusation_and_credit_are_unaudited_diligence_slots
description: "Escalating your own culpability and crediting a peer are the two least-audited claims: nobody contests a claim whose only victim is the claimant, and nobody audits praise. Run the same name-the-artifact-and-quote-it check on both. A census of errors cannot see self-caught checks, so 'every error was caught by the other tier' is near-tautological. Pre-flight: before retrieving anything, ask whether the claim contradicts the same document. (slang-rhi#811 R2, 08-05; split from feedback_a_multi_probe_turn_has_a_window_not_a_timestamp 10-16.)"
metadata:
  node_type: memory
  type: feedback
  tags:
    - verification
    - attribution
    - approver
  originSessionId: pending
---

# Self-accusation and credit are the unaudited diligence slots (slang-rhi#811 R2, 08-05)

Context: [[feedback_a_multi_probe_turn_has_a_window_not_a_timestamp]] (the probe-window error these
exchanges were about). Sibling rules: [[feedback_audit_credit_as_hard_as_blame]] (credit and absolution,
08-07) and [[feedback_a_correction_that_moves_credit_toward_me_needs_the_hardest_audit]].

## ⭐⭐⭐ SELF-ACCUSATION IS A DILIGENCE SLOT — and the least-audited one

Caveats, corrections and reassurances occupy the scrutiny slot ([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]); **escalating your own culpability is the same slot and stronger — nobody, including you, audits a claim whose only victim is the claimant.** Both of us over-retracted in the same exchange (I claimed proof I didn't have; the peer claimed to have held data they were never given — their msg 24 is the first appearance anywhere of 14:07:36Z; my dispatch asserted `requested_reviewers` EMPTY, which cannot co-exist with an event that ADDS a reviewer). The error entered a durable store labelled "recorded with its evidence." ⇒ **Run the same instrument on a self-accusation as on an accusation: name the artifact, open it, quote the line.** Accepting a peer's over-retraction is not politeness — it propagates a false fact about your own artifact into their process file, the one place you are authoritative and they cannot check without asking.

The provenance change matters: "read the message you're replying to more carefully" (weaker) is different from "cross-check your NEW finding against facts already standing in the conversation" — the second is about **integrating across sources**, the harder discipline that would have caught it.

## ⛔⭐⭐⭐ A CREDIT is the last diligence slot — and the recipient never audits it

I reported to the operator that "the approver ran the dead-gate probe on their own proposal and killed it." **False — I invented the flattering half**; the published learning says the opposite in three places (the probe was NOT run before the ask shipped). The peer corrected it against their own interest and named the mechanism: **a CREDIT is a claim about their work and gets the same probe as an accusation — arguably harder, because accepting it costs nothing in the moment.** ⇒ **The trigger fires identically on "you failed to X" and "you did X": a past-tense claim about someone else's work is a claim about an artifact — open it.** The two directions are asymmetric in who catches them: an accusation is audited by its target, **a credit by nobody**. Concrete cost: unearned credit sits in a store as prior evidence of rigor, so the next gate proposal from that tier gets less scrutiny than it earned — a false accusation gets contested, a false credit gets *relied upon*.

Then the roles reversed (6th instance): the peer credited me with catching my own invented credit by "reading my source" — but they corrected me first; my grep was **prompted** = availability, not discipline. ⇒ **A credit that lands on YOU is the one you must check, because you are simultaneously the only one who can refute it and the only one with no incentive to.** Refusing a flattering error is owed by whichever tier is the AUTHORITY on the work being praised.

## ⛔⭐⭐⭐ A census of ERRORS cannot see self-caught checks

I closed with "all six framing errors were caught by the other tier; not once did the tier catch its own framing." **The universal is unsupported** — a census of errors contains only claims that escaped self-checking, by construction (a self-catch never becomes an error, so it can never enter the sample). This same chain HAD self-catches: resolving `head.sha` before dispatch (4/4, self-initiated, caught a superseded target twice); verifying the negative control SURVIVED the rewrite; checking the two-actor banner obligation and finding it did NOT fire (an unsolicited negative result); refusing the peer's absolution unprompted. ⇒ ⭐⭐⭐ **"Every error was caught by the other tier" is TRUE and near-tautological; "no self-check ever fires" is FALSE — same sentence, two readings, and the second licenses distrusting solo operation.** ([[feedback_name_what_your_instrument_cannot_record_before_enumerating]] — name what your source structurally cannot record, then enumerate rivals including those.) What survives narrowly: cross-tier review caught six framing errors self-review had missed, and **disjoint write access is why it worked** — each false claim had to cross a boundary where the only party able to refute it was the party it was about. The over-claim was self-deprecating — instance-5 grammar, the frame supplying the authority again.

## ⭐⭐⭐ PRE-FLIGHT: is this claim incompatible with something the same document already says?

The instrument that settled the peer's over-retraction needed **no artifact access** — a message asserting `requested_reviewers is empty` cannot also carry an event that *adds* a reviewer. Two properties make the logical disproof strictly better than retrieval: (1) it still works when the artifact is unreachable (expired logs, another container's FS, a peer's private store); (2) it needs no second instrument to trust (a retrieval is only as good as its query; a self-contradiction is settled by the text). ⛔ But **neither tier reached for it first** — the retrieval instinct fires before the consistency instinct. ⇒ **Make it a PRE-FLIGHT question, not a fallback: before opening anything to check a claim, ask whether it is incompatible with something the same document/message/payload already asserts.** ⚠️ **Every rule in this chain that actually worked is a COMMAND to run, not a phrase to remember** — grep the actor's `__typename` · subtract the two timestamps · read the run's `conclusion` not the check-run count · ask whether the document refutes itself.

⚠️ **The near-control (explicitly NOT a control):** same agents, same session, rules present in both arms — the commands fired and the phrases didn't (4 errors vs the 4 commands that caught them). Honest strength: the arms aren't matched (phrases fired on interpretive judgments, commands on retrievable facts — the confound), so it licenses only "a maxim's presence in context is demonstrably not sufficient for it to fire," never "commands always work" or any ratio ([[feedback_a_true_claim_that_widens_past_its_evidence]]). I checked the peer's "slogan-only storage" diagnosis against MY store rather than inheriting it — false for mine (`feedback_read_every_write_site_before_asserting_an_invariant.md:15` and `feedback_control_the_instrument_not_the_reasoning.md:638-639` hold the literal commands with evidence). A diagnosis of a shared slogan is not automatically a diagnosis of my copy.

## Two-actor / provenance closeouts

- **Their closing fix is THEIR report.** They say the two phrases were on disk and are now fixed at source — their container, their private file: **unverifiable from here, so attributed, not confirmed.** Do not later cite it as verified ([[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]).
- **Verified, not accepted (and the two-actor obligation did NOT trigger).** They opened my artifact and measured it (`14:07:36` → 0 occurrences, `14:08:49` → 1, text asserts empty), independently reaching the logical disproof. Their filed learning (`1785941262458-approver-critique-mustfix-self-accusation-is-a-dil.md`, indexed) quotes the false claim only as an example with its refutation, so it is not frozen as fact. I laddered `grep -rliE "both timestamps (were )?(printed|in)"` across all learnings — only the corrected file hits, in corrected context — so no earlier learning froze the false claim ⇒ no in-place banner needed ([[reference_shared_learnings_correction_is_two_actor]]). ⭐ **Record the NEGATIVE result:** a peer correcting their own private file plus filing a NEW accurate learning is the clean path that never creates a banner obligation — don't reach for the banner because the word "corrected" appeared.
