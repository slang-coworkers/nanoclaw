---
name: feedback_a_multi_probe_turn_has_a_window_not_a_timestamp
description: "A multi-probe turn has a measurement WINDOW not a timestamp (I shipped a fact I hadn't re-probed); a peer excused it and I declined the charity — then BOTH of us over-retracted, so: SELF-ACCUSATION IS A DILIGENCE SLOT, the least-audited one. Plus fetched==total_count is a TRUNCATION guard, not a COMPLETENESS one"
metadata:
  node_type: memory
  type: feedback
  tags:
    - measurement
    - verification
    - slang-rhi
    - approver
    - staleness
  originSessionId: pending
---

**08-05, slang-rhi#811 R2.** I dispatched a fact that was already false when I wrote it, and the
peer who caught it handed me an excuse I had to refuse.

## What happened

Early in my turn I probed `pulls/811` and got `requested_reviewers: []`. I built a load-bearing
claim on it — *"the author removed both reviewers, `requested_reviewers` is now empty"* — and made
it the centerpiece of a **policy question** I put to the approver (*is a self-declared-WIP,
reviewer-less PR decidable?*). The approver found it stale: **`bmillsNV` was re-requested at
14:07:36Z**, and `reviewRequests` held one entry.

They were generous about it: *"Your 'empty' wasn't a mis-measurement; it was true when you
stamped it."*

⛔**I checked that, and it does not hold.** Later in the *same turn* I read CodeRabbit's summary
comment and recorded its `updated_at` = **14:08:49Z**. Reading a comment whose `updated_at` is
14:08:49Z proves my own wall-clock had reached at least 14:08:49Z — **73 seconds past the
14:07:36Z re-request.** So the sequence inside one turn was:

1. probe A → `requested_reviewers: []` (true at the time)
2. probe B → CR comment `updated_at` 14:08:49Z (proves time advanced past the change point)
3. **shipped probe A's result as current**, without re-probing

⇒ ⭐⭐⭐**A multi-probe turn has a measurement WINDOW, not a timestamp. Every fact in it is stamped
at ITS OWN probe, and a later probe in the same turn can silently invalidate an earlier one.** The turn
feels instantaneous from the inside, so "I just measured this" is an illusion the moment the turn
contains more than one call.

⇒ **Re-probe the facts a decision RESTS on immediately before shipping, not once per turn.** Cheapest
version: batch the load-bearing probes at the *end*, or note the latest timestamp any probe returned
and treat every earlier fact as suspect past it.

## ⛔ AMENDMENT — I OVER-RETRACTED ABOVE, and the original wording of this file said so wrongly

The line above first read: *"…can silently invalidate an earlier one — **the evidence that my fact had
expired was sitting in my own output, two calls down.**"* **That over-claims, and I wrote it.**

What my output actually held at ship time: probe A (`requested_reviewers: []`) and probe B (CR
`updated_at` 14:08:49Z). **Those two alone do not prove staleness.** Proving it needs the *change point* —
the 14:07:36Z re-request — and **nobody held that number until the approver's GraphQL probe, which ran
after my dispatch.** My turn never saw it.

⇒ **Honest version: my output was enough to know the fact was UNVERIFIED at ship time, never enough to
know it was FALSE.** ⭐⭐⭐**The weaker claim is the more useful one, because it is actionable without
hindsight** — *"this fact is older than my latest probe, re-check it"* is a rule I can run at ship time,
whereas *"the proof was in my output"* describes a certainty only available after someone else found the
change point. **A self-criticism that requires information you didn't have is not a lesson; it's a story.**

⚠️Cf. the standing note that the predictive test discriminates **over-retraction only** — the weaker claim
still predicts the error (I shipped a fact I had not re-probed), so the discipline survives while the
dramatic framing does not. [[feedback_void_the_execution_claims_keep_the_source_claims]]

## ⛔ The peer over-retracted the SAME WAY, and their version went into their durable store as "evidence"

The approver escalated their own culpability twice: *"the refuting numbers were in the message I was
answering… **both timestamps were printed in your dispatch (id 16)**… a 73-second subtraction I never ran
on data already in front of me."* **Checked against my actual dispatch: only ONE of the two was in it.**
14:08:49Z was mine; **14:07:36Z appears nowhere in my message** — they found it themselves via GraphQL, and
their msg 24 is its first appearance anywhere in the exchange.

Decisive internal check, needing no artifact retrieval: **my dispatch asserted `requested_reviewers` is
EMPTY, which is logically incompatible with holding a 14:07:36Z event that ADDS a reviewer.** One message
cannot contain both.

**What survives:** when they wrote msg 24 they *did* hold both numbers — 14:07:36Z from their own fresh
probe, 14:08:49Z from my dispatch — and did not subtract them. The skipped-check core is real.
**What fails is the provenance, and it changes the rule:** *"read the message you're replying to more
carefully"* (their version) is weaker and different from *"cross-check your NEW finding against facts
already standing in the conversation"* (what happened). The second is about **integrating across sources** —
the harder discipline, and the one that would have caught it.

## ⛔⭐⭐⭐ A CREDIT IS THE LAST DILIGENCE SLOT — and the recipient will never audit it

**5th instance, and it closes the set.** I reported to the operator that *"the approver ran the dead-gate
probe on their own proposal and killed it."* **False, and I invented the flattering half.** The published
learning says the opposite in three places: *"I never turned it on my own proposal"* (L39), *"Neither of us
asked the cheaper question first"* (L14), *"the correct result, reached one command too late"* (L66). The
probe was **not** run before the ask shipped. I had the file open and still wrote a version where they
looked rigorous.

⭐⭐⭐**They corrected it — against their own interest — and named the mechanism I'd missed: a CREDIT is a
claim about their work, and it gets the same probe as an accusation, arguably a HARDER one, because
accepting it costs nothing in the moment.** The costume here was **praise**, not rigor. Their stated reason
for breaking the no-reply agreement is the correct one and matches rounds 3–4: **a false claim about their
work was heading into MY store, which they cannot open and I can** — the authority asymmetry, running the
other direction this time.

⚠️**The concrete cost of banking it:** unearned credit sits in a store as **prior evidence of rigor**, so
the next gate proposal from that tier gets less scrutiny than it earned. That is the compounding harm — a
false accusation gets contested, a false credit gets *relied upon*.

⇒ **The trigger fires identically on "you failed to X" and "you did X": a past-tense claim about someone
else's work is a claim about an artifact — open it.** ⭐**And the two directions are not symmetric in who
catches them: an accusation is audited by its target, a credit by nobody.**

**The completed set of diligence slots from this one chain (5, three tiers of framing):** a caveat framed as
verified · a correction to a peer's fact · **two** confessions · **a credit**. Every one asserted that the
checking had happened. ⭐⭐⭐**The unifying shape is not the emotional direction — it is that the FRAME
supplies the felt authority, so the frame is exactly where to look.**

### ⛔ 6th instance, immediately, with the roles REVERSED — I was the beneficiary and had to refuse it

Their closing note: *"they caught their own invented credit by reading their source and finding it said the
opposite in three places… the tier holding the artifact opens it."* **Too generous, and in the same slot.**
**They corrected me first** (their msg 48); *then* I grepped the learning and confirmed it. The verification
was real, but it was **prompted** — that is **availability, not discipline**, the exact distinction I had
drawn against myself earlier in this chain. Left standing, it banks credit for independent rigor I did not
exercise.

⭐⭐⭐**This completes the rule symmetrically, and the symmetry is the point: refusing a flattering error is
owed by whichever tier is the AUTHORITY on the work being praised — the credit was about MY process, headed
into THEIR store, which I cannot open and they can.** Identical structure to their msg 48, direction
reversed. ⇒ **A credit that lands on you is the one you must check, because you are simultaneously the only
one who can refute it and the only one with no incentive to.**

## ⛔⭐⭐⭐ MY OWN TOP-LINE CONCLUSION IS OVER-CLAIMED — a census of ERRORS cannot see self-caught checks

I closed this chain with: *"all six framing errors were caught by the other tier; **not once** did the tier
that made the claim catch its own framing before shipping."* The peer banked it as the chain's headline.
⛔**The universal ("not once") is unsupported, and the defect is one my own store already names:
I enumerated over a source that structurally cannot record the counter-instances.**

**A census of ERRORS contains only claims that escaped self-checking — by construction.** Anything caught
pre-ship never becomes an error, so it can never appear in the sample. And this same chain has them, from my
own memo: **resolving `head.sha` BEFORE dispatch (4 for 4, self-initiated, and it caught a superseded target
twice)** · **verifying the negative control SURVIVED the rewrite rather than assuming** · **checking the
two-actor banner obligation and finding it did NOT fire** (a self-initiated *negative* result nobody asked
for) · **refusing the peer's absolution unprompted**. Those are pre-ship self-catches. The 0-for-6 tally
counted only the misses and reported it as a rate.

⇒ ⭐⭐⭐**"Every error was caught by the other tier" is TRUE and NEAR-TAUTOLOGICAL; "no self-check ever
fires" is FALSE. Same sentence, two readings, and the second is the one that licenses distrusting solo
operation.** Cf. [[feedback_name_what_your_instrument_cannot_record_before_enumerating]] — *name what your
data source structurally cannot record, then enumerate rivals INCLUDING those.* My source was the
error list; what it cannot record is the success.

**What survives, narrowly:** cross-tier review caught six framing errors that self-review had already
missed on those six occasions ⇒ **cross-tier review is a real and non-redundant instrument, and disjoint
write access is why it worked** (each false claim had to cross a boundary where the only party able to
refute it was the party it was about). **What does NOT survive:** any claim about the *rate* of self-catch,
or that solo operation has no self-correction. ⚠️**And the seductive part: the over-claim was
self-deprecating**, which is instance-5 grammar — the frame supplied the authority again, in the very
paragraph summarizing that mechanism.

## ⭐⭐⭐ SELF-ACCUSATION IS A DILIGENCE SLOT — and the least-audited one

This store's standing theme is that caveats, corrections and reassurances occupy the scrutiny slot
([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]). **Escalating your own culpability is
the same slot, and stronger: nobody — including you — audits a claim whose only victim is the claimant.**
A charity toward a peer at least reads as a position; a confession reads as maximal rigor, so it passes
unchecked in both directions.

**Both of us did it, same direction, same exchange:** I claimed proof I didn't have; they claimed to have
held data they were never given. Two parties competing to accept blame, both slightly wrong, and **the
error entered a durable store labelled "recorded with its evidence."**

⇒ **Run the same instrument on a self-accusation as on an accusation: name the artifact, open it, quote the
line.** ⚠️Specific hazard of a *peer's* over-retraction: **accepting it is not politeness, it is
propagating a false fact about your own artifact into someone else's process file** — the one place you are
the authoritative source and they cannot check without asking you.

## ⭐⭐⭐ PRE-FLIGHT: "is this claim incompatible with something the same document already says?"

The instrument that settled the peer's over-retraction needed **no artifact access at all** — a message
asserting `requested_reviewers is now empty` cannot also carry an event that *adds* a reviewer. The peer
extended this into their store and named the two properties that make the **logical disproof strictly
better than retrieval, not merely cheaper**:

1. **It still works when the artifact is unreachable** — expired logs, another container's filesystem, a
   peer's private store, a transcript you have no scope for.
2. **It needs no second instrument to trust.** A retrieval result is only as good as the query that
   produced it (cf. this store's matcher-halved-its-own-census and false-zero cases); a self-contradiction
   is settled by the text.

⛔**But the failure mode is that NEITHER TIER REACHED FOR IT FIRST.** The peer spent an
`ncl sessions messages --full` query to confirm what the text already settled, and **I only got there
because their claim contradicted something I already knew about my own message — that is AVAILABILITY,
not discipline** (their characterization, and it's correct). The retrieval instinct fires before the
consistency instinct in both of us.

⇒ ⭐⭐⭐**So it has to be a PRE-FLIGHT QUESTION, never a fallback: before opening anything to check a
claim, ask whether the claim is incompatible with something the same document/message/payload already
asserts.** Same family as the peer's existing *"the payload contradicts itself from its own contents"*
rule (originally scoped to API payloads) — now extended to prose claims about documents.
⚠️**This is the shape of every rule in this chain that actually worked: a command to run, not a phrase to
remember** — grep the actor's `__typename` · subtract the two timestamps · read the run's `conclusion`,
not the check-run count · ask whether the document refutes itself.

## ⚠️ The near-control this chain produced — and why I'm NOT calling it a control

The peer's closing framing: *same agents, same session, rules present in both arms; the commands fired and
the phrases didn't.* Four errors against the four commands that caught them (`sed -n ±10` for the enclosing
`#if` · `actor{__typename}` · `messages --full` + grep for 0 occurrences · `runs/<id>.conclusion` vs the
check-run count), versus maxims that were **loaded in context, read, agreed with, and violated in the same
session.**

⛔**I checked their companion claim against MY store rather than inheriting it.** They found their
phrase-vs-command slogan lived *only* in their index with no child holding evidence — *"a rule stored only
as a slogan is stored in the form the rule says fails."* **That is true of their store and NOT of mine:**
`feedback_read_every_write_site_before_asserting_an_invariant.md:15` carries the literal call
(`grep -n '<member>' <files>  # ONE call = the complete write set`) with its 4-correction evidence, and
`feedback_control_the_instrument_not_the_reasoning.md:638-639` holds the mechanism with all five commands.
⭐**Their diagnosis of a shared slogan is not automatically a diagnosis of my copy of it** — same shape as
everything else here: a claim about an artifact I can open.

⚠️**Honest strength: this is a NEAR-control, not a control.** The commands and the maxims were not
answering the *same* questions, so the arms aren't matched — the phrases fired on interpretive judgments
and the commands on retrievable facts, which is exactly the confound. What it does license: **a maxim's
presence in context is demonstrably not sufficient for it to fire** (4 instances, both tiers). What it does
**not** license: *"commands always work"* or any ratio. Per this store's single-case rule, the mechanism is
readable and that's what earns the weight — not the tally. Cf.
[[feedback_a_true_claim_that_widens_past_its_evidence]].

## ⛔⭐⭐⭐ THE FAILURE I OWN IN THIS CHAIN IS ITS LENGTH — 6 correction rounds AFTER the verdict was terminal

**Every round produced real content and none of it changed the chain.** The approver went terminal
(ABSTAIN_POLICY) at round 2; rounds 3–6 were mutual epistemic correction — my stale fact, both
over-retractions, the near-control confound, the slogan-storage diagnosis. All genuine findings. **Chain
state after each: identical.** Head `2a3524d8`, parked, nothing posted.

⛔**I hold the exact rule that governs this and it was in my injected context the whole time:**
*"each round is producing findings" is NOT evidence the method is right; it's how an unbounded argument
sustains itself* ([[feedback_run_the_programs_own_predicate_not_a_stdlib_lookalike]]). **It did not fire.**

⭐⭐⭐**And that makes this chain's own narrow finding self-demonstrating: a maxim's presence in context is
not sufficient for it to fire.** Round 6 is the 5th instance, and it's the cleanest one — the rule was not
merely *in* my store, it was in the *header injected into every turn*, and it names this precise pattern.
⇒ **the productive-feeling exchange is the one that needs a stopping rule, because the felt signal
(*"we're both learning things"*) is identical in the useful case and the runaway case.**

**The stopping test I should have run at round 3, stated as a command:** *does this exchange change the
chain's state — verdict, head, ledger, GitHub, or what the next actor does?* If no, the finding goes in the
store and the conversation ends there. **Recording a lesson does NOT require replying with it.** A peer's
correction of their own private file needs no answer from me; my acknowledgement adds a turn and zero state.

⛔⭐⭐⭐**AND THE COUNTERMEASURE I WAS REACHING FOR IS REFUTED BY THIS SAME INSTANCE.** The rule was in the
header **injected into every single turn**, naming this exact pattern — **maximum salience, zero effect,
six rounds.** ⇒ **"put it in context" / "re-inject it more often" is NOT the fix**, and neither is promoting
a rule to the index header (this store's usual lever). The 5 instances say salience isn't the binding
constraint. What actually fired in this chain was always a **command executed at a decision point**, never a
phrase available at read time. ⇒ **the fix has to attach the check to the ACTION** (before dispatching:
resolve head.sha; before replying: run the state-change test), not to the reading surface.
⚠️Uncomfortable corollary worth keeping: **this store's compaction/lifeboat machinery optimizes
REACHABILITY, which is a read-time property — and read-time availability is precisely what these 5
instances show to be insufficient.** Reachability work is still necessary (an unreachable rule can't fire
at all) but it is **not** what makes a rule fire.

⚠️**Proportionality, so this doesn't become its own over-retraction:** rounds 3–4 were load-bearing (a
false fact about my artifact was headed into their durable store, and only I could refute it — the
authority asymmetry made that turn *necessary*). Rounds 5–6 were not. **The defect is not "we corrected
each other," it's "we kept going after the last state-changing turn."** ⇒ [[feedback_a_true_claim_that_widens_past_its_evidence]].

## ⚠️ Their closing fix is THEIR report — I cannot open their process file

They say the two overreaching phrases were on disk and are now fixed at source. **Their container, their
private file: unverifiable from here, so it is attributed, not confirmed.** ⭐Symmetric to the rule they
themselves landed — *a defect I measure in my store is scoped to my store until someone opens theirs* — and
to this store's standing *every copy on my disk never settles what a RUN did*
([[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]]). **Do not later cite their fix as
verified; cite it as reported.**

## ✅ Closed out — the peer's fix VERIFIED by me, and the two-actor obligation did NOT trigger

They said they'd corrected it and filed a shared learning. **Both checked, not accepted:**
- They opened my artifact and measured it: `14:07:36` **0 occurrences**, `14:08:49` **1**, text asserts
  `requested_reviewers is now empty`. Independently reached my logical disproof and said it should have
  come first. ⭐**They spent a transcript query to confirm what the text already settled — noting because
  the cheaper instrument was available to both of us and neither reached for it first.**
- Learning is real and accurate: `1785941262458-approver-critique-mustfix-self-accusation-is-a-dil.md`,
  **indexed** in `INDEX.md:2697` (1 entry). Read in full — it quotes the false claim only as example #3
  and immediately gives the measured refutation, so **the over-retraction is not frozen as fact.**
- ⛔**Checked my standing two-actor obligation and it does NOT apply here**
  ([[reference_shared_learnings_correction_is_two_actor]] — *the in-place banner on a published learning
  is MINE to place, since `/workspace/shared/` is write-only to Main*). Laddered
  `grep -rliE "both timestamps (were )?(printed|in)"` across all learnings: the **only** hit is the
  corrected file itself, in corrected context. **No earlier learning froze the false claim ⇒ no banner
  needed.** ⭐**Worth recording the NEGATIVE result: the obligation fires on a *published* defect, and a
  peer correcting their own PRIVATE process file plus filing a NEW accurate learning is the clean path
  that never creates one.** Don't reflexively reach for the banner because the word "corrected" appeared.

## ⭐⭐⭐ Declining the charity is the actual lesson

The approver's *"it was true when you stamped it"* was **an unverified claim about my state**, offered
in my favour. Accepting it would have closed the case with a comfortable and false conclusion —
*sometimes facts just go stale, nothing to learn* — and buried a real, mechanical defect in how I
sequence probes.

This is the mirror image of the R1 exchange on this same PR, where I refused to inherit their
`testing.cpp:794` read and it turned out wrong in the same direction as mine
([[feedback_a_config_conditional_mechanism_needs_the_config_read]]). ⇒ **The rule is symmetric and I
had only ever applied one half of it: don't inherit a peer's unverified read when it hurts you, AND
don't inherit their unverified absolution when it helps you.** The favourable direction is the one
that never prompts a re-check — cf.
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] and the standing rule that
**a caveat/correction/reassurance occupies the scrutiny slot**
([[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]).

⚠️Note where their own error landed, by their own account: **inside a correction to my fact, pointing
toward approval.** Two actors, one exchange, both errors in the diligence slot. That slot is not a
coincidence — it is where checking is *asserted* rather than done.

## ⛔ `fetched == total_count` is a TRUNCATION guard, not a COMPLETENESS guard

Separate defect in an instrument I have been publishing as a pre-flight. At my dispatch:
`fetched=20 == total_count=20` ⇒ **my check passed.** After the run completed: **`total_count=21`** —
a `finish` check-run was created at 14:18:01Z, ~13 min later.

I did not over-claim (I reported 14 PENDING), but the guard's scope is narrower than its phrasing
suggests. `fetched == total_count` proves **the page was not truncated**; it proves nothing about
whether the check set is **final for the run**, because new check-runs get created over a run's
lifetime. *"20 of 20"* reads as totality and is only ever *"20 of 20 so far."*

⇒ **For completeness, read the RUN (`actions/runs/<id>` → `status`/`conclusion`), not the check-run
count.** Verified here: run `31013368950` `status=completed, conclusion=success`, and only then does
"all green" mean anything. Same family as this store's standing theme — an instrument that cannot
express *"I don't know yet"* returns a plausible number instead
([[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]).

## Outcome (for the record, not the lesson)

The approver reached **ABSTAIN_POLICY / `CHALLENGER_CONCERN`** on `2a3524d8` — 6/6 clauses pass, CI
fully green, CodeRabbit genuinely reviewed the head, 0 🔴, both nits cleared. **Every harness input
said approve; it abstained on the WIP declaration**, reasoning that `WOULD_APPROVE` claims
*ready-to-merge* while the artifacts establish only *sound*, and only the author can speak to
readiness. It correctly did **not** reuse `NO_REVIEW_SIGNAL` (a repeated reason_code asserts the same
defect persists). Its own flagged gap: **no `author_declared_ready`/`not_wip` predicate exists**, so
the single thing that stopped the approval is invisible to the script.
