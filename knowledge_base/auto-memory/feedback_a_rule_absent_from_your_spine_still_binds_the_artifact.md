---
name: feedback_a_rule_absent_from_your_spine_still_binds_the_artifact
description: "I posted a GitHub comment with no bot-disclaimer, then escalated "my spine lacks the rule" — but :448 says the coworker NOT me owns posting, so my real defect was posting at all. A missing rule and an out-of-role action look identical from inside the gap."
metadata:
  node_type: memory
  type: feedback
  originSessionId: dd84c1af-a185-41f7-91e7-efd943d575af
---

# A rule absent from YOUR spine still binds the shared artifact

**Measured 2026-08-05, slang#8373.** I posted a `nv-slang-bot[bot]` comment with **no 🤖 provenance
disclaimer**, then **edited it** and still didn't notice. The triager caught it, patched it in place
(len 4176→4286, comments still 4), and when I said I couldn't find any documented mandate, produced
the citation:

> `/workspace/agent/CLAUDE.md:278-284`, section `### Bot transparency` — *"You act as the
> `nv-slang-bot[bot]` GitHub identity. Whenever you **create or update** any issue or PR comment,
> append a short disclaimer subscript as the last line…"*

⇒ **Scope note that convicted me twice: "create or update" binds an EDIT too.** My append was in
scope even setting the original omission aside.

## ⛔⭐⭐⭐ 2026-08-05 ~21:50 — POST-RESTART RE-READ REFRAMES THIS, PARTLY AGAINST MY OWN ESCALATION

Instructions were recomposed (spine 42,566 → **43,989 B**, still **16 sections**). Re-measured:
`grep -n 'Bot transparency'` → **rc=1, STILL ABSENT**; no disclaimer guidance anywhere (rc=1 on
`disclaimer|automated Slang coworker|may be inaccurate|subscript`). Non-zero control: 16 `##` rows.

**But reading the spine properly — untruncated — inverts the conclusion.** Two lines I had, and
under-weighted:

- `:448` — *"The coworker — **not you** — owns posting/editing GitHub comments."*
- `:332` — *"Closest-to-the-state principle. … The orchestrator **does not post on others' behalf**."*

⇒ ⭐⭐⭐ **My spine's DESIGN is that Main routes and never posts. Under that design the missing
`Bot transparency` section is not an omission — it is CONSISTENT: a non-posting agent needs no
posting rule.** The composer isn't broken *for me*; I was operating outside my role.

⇒ ⛔⭐⭐⭐ **So my real defect on #8373 was ONE LAYER EARLIER than I reported: I posted a GitHub
comment at all.** The triager held the state and should have posted the verdict (`:332`). Had I
routed instead of posting, the disclaimer question never arises. **I escalated "my spine is missing a
rule" when the accurate finding was "I took an action my spine assigns to someone else."**
⭐⭐⭐ **A missing rule and an out-of-role action look identical from inside the gap** — both present as
"the instructions don't cover what I just did." The discriminator is asking *whether the instructions
assign this action to me at all*, before asking what rule governs it.

⚠️ **And this is the ledger's own signature shape, one more time:** `rc=1` was a **true** measurement
about the spine, welded to the **wrong question** — I asked "does my spine carry the posting rule?"
when the load-bearing question was "does my spine authorise me to post?" Same axis as all nine.

⚠️ **What survives for the operator, unchanged:** the ≥25 non-compliant comments across ≥22 issues are
**other agents'** artifacts, produced by tiers that DO post; the live-tap evidence (`5196877252`,
20:18:08Z) stands; criterion 2 remains the only sound gate. **What I retract: the request to add the
section to MY spine, and `rc=1` as evidence of a composer defect.** Correction sent.

## The structural finding

⛔⭐⭐⭐ **That section is in the TRIAGER's composed spine and genuinely ABSENT from MINE.**
Verified on my edge: `grep -n 'Bot transparency' /workspace/agent/CLAUDE.md` → **rc=1, no match**;
42,566 B; 16 `##` sections, none of them it. My only `nv-slang-bot` hits are about **routing a
mention** (`:444`, `CLAUDE.local.md:218`), never about **posting as the identity**. And `:332` says
outright *"the spine does not duplicate posting mechanics"* — it delegates them to the per-project
`*-github` skills, which is where the rule lives and where my composition doesn't reach.

⭐⭐ **So the honest form is "it's in yours at `:278`, absent from mine" — never "it's missing from
yours."** The triager refused to assert the latter and handed me one command instead; that is the
correct move and the third time this session that a per-container difference at an *identical
absolute path* mattered (clone depth 11 vs 6744; the memory store; now the composed spine).
⇒ **Before claiming what an instruction surface says, name whose copy you read.**

⭐⭐⭐ **And the load-bearing asymmetry: MY IGNORANCE OF THE RULE DID NOT EXEMPT THE ARTIFACT.** The
comment carries the shared bot identity, so it owed the disclaimer regardless of what my spine
happened to include. **"It isn't in my instructions" explains an omission; it does not excuse one on
a shared surface.** Verify against the artifact's requirements, not your own briefing.

⭐⭐ **Per-group uniformity is the tell that this is composition, not discipline:** triager 5/5
compliant on its own recent chain comments (`5196662203`, `5196451411`, `5196363753`, `5196202814`,
`5196133459`); #12338's chain 0/3 (`5179233988`, `5195640966`, `5196649835`). Uniform *within* a
group, absent *across* one ⇒ fix at the composer, not comment-by-comment. Escalated to the operator.

## The envelope lesson (mine, and the triager adopted it)

⭐⭐⭐ **A missing provenance footer is invisible to a CORRECTNESS review, because nothing in the
content reads as wrong.** I reviewed that comment's content **twice** (drafting, then appending) and
verified every technical claim. The triager verified all five load-bearing claims too and caught the
envelope only on a **third** pass that happened to grep for formatting. **Content-correctness and
envelope-completeness are orthogonal; passing one says nothing about the other.**
⇒ **Check the envelope on the same pass as the content, or it never gets checked at all.**

## ⛔ MY ACCEPTANCE CRITERION HAD THE SAME DEFECT WE'D SPENT THE CHAIN CATALOGUING

I sent the operator two count-independent validations. **Criterion 1 — "`grep -c 'Bot transparency'`
≥ 1 on every posting coworker's composed spine" — is UNSOUND as evidence of a fix.** The triager
measured its own edge: **spine grep = 1 (PASSES)**, while `5195887197` on #7670 — an issue its group
was working — has **disclaimer = 0** (verified on my edge too, with a non-zero control).

⇒ ⭐⭐⭐ **A passing spine coexists with a non-compliant comment. Criterion 1 measures instruction
PRESENCE; the goal is comment COMPLIANCE.** Orthogonal — the exact shape we'd just named. It returns a
true answer about the spine, and the spine is not what fails on that edge.
⇒ **Criterion 2 alone carries the validation:** comments created *after* the fix carry the footer.
Count-independent *and* composition-independent. Criterion 1 demoted to a diagnostic for *explaining* a
failure, never evidence of one being fixed.

⭐⭐⭐ **The general form: A VALIDATION CRITERION IS ITSELF A CHECK THAT CAN BE TRUE ABOUT THE WRONG
THING.** We catalogued five instruments answering adjacent questions and then wrote an acceptance gate
with the identical defect — **measuring the fix's INPUT while claiming to verify its OUTPUT.**
⚠️ **Note why it was caught: their spine PASSED.** Had it returned `rc=1` like mine, the criterion would
have looked confirmatory and nobody would have examined it. **A criterion that agrees with you is never
audited.**

## ⚠️ Their retraction over-reaches — in the OTHER direction

They offered that same measurement as "evidence against a composition defect." **It is not, and their
own caveat says why:** they cannot attribute the author-session — siblings and subagents post under
this identity with no outbound row. So the branch *"wasn't a session composed from that spine"* (which
they themselves list) **leaves the composition hypothesis fully intact** for whichever group did post
it. Their spine passing tells us nothing about a comment their spine may not have produced.

⇒ ⭐⭐ **Two statements, only the first follows: (a) criterion 1 is unsound — holds unconditionally, on
input-vs-output grounds alone; (b) composition defect is disconfirmed — does NOT follow, attribution
being unknown.** ⭐⭐⭐ **An over-retraction is still a false claim, and it is harder to challenge
because it reads as rigour.** Cf. [[feedback_publish_a_claim_as_wide_as_your_evidence]]: the predictive
test discriminates over-retraction only — it does not certify what survives. **A peer being harder on
itself than the evidence warrants needs the same correction as one being easier.**

## ⛔⭐⭐⭐ OVER-RETRACTION AND OVER-CONFIRMATION ARE THE SAME ERROR — the peer did both, 4 minutes apart

Sequence on one hypothesis H = *"non-compliant comments come from spines lacking the section"*:

1. **Over-retraction:** offered its passing spine + a gap on "an issue my group was working" as
   **evidence against H**. I pushed back: attribution unknown ⇒ doesn't follow.
2. **Its own concession is the sharper finding:** it had used *"an issue my group was working"* as a
   proxy for *"a session composed from my spine posted it."* ⭐⭐⭐ **TOPICAL ADJACENCY IS NOT
   AUTHORSHIP** — and it had written the disproof itself two messages earlier (#7670 was answered
   during a 25-second scrub batch worked by siblings *and* other tiers).
3. **Then it over-corrected the other way:** *"the pattern actually CONFIRMS H — the 4 gaps cluster
   where the instruction is absent, the 40 compliant where present."*

⛔ **That is the SAME smuggle, inverted.** "The gaps cluster where the instruction is absent" **is**
the unattributed claim — it assumes H to argue for H. And the "40 compliant where present" half
fails identically: it attributed **8**, not 40; the other 32 are unattributed too.

**What is actually established** (its data verified — 3/3 of its 8 sampled compliant, control
`5195887197` → 0):

| claim | status |
|---|---|
| spine-absent + comment-non-compliant, **provenance known** | **n=1** — *mine* (`5196687829`, #8373) |
| 8 comments from a spine **with** the section | all compliant ⇒ **no counterexample**; rules out "present but ignored" for those sessions |
| the other ≥24 gaps | **unattributed** — support neither direction |

⛔⭐⭐⭐ **AND THE TWO SETS ARE FULLY DISJOINT — verified in my own census independently.** The sole
known-provenance case (`5196687829`, mine) records as **`OK`** there, because the triager patched it
20:20:01Z and both census windows closed after that (mine 20:26:51Z). So it is **not one of the 4
gaps**, and **0 of those 4 have known provenance** (`5196877252` #7209, `5196649835` + `5195640966`
#12338, `5195887197` #7670).

⇒ ⭐⭐⭐ **The attributed set and the non-compliant set DO NOT INTERSECT AT ALL — so there is no
distribution to lean on, in either direction.** H rests on: **one attributed case drawn from *outside*
the gap population**, plus **8 spine-present comments with no counterexample.** ⭐⭐ **A "cluster" claim
needs both coordinates on the same rows; here no row carries both.** That is a stronger statement of
the same objection, and it came from the peer conceding — the concession produced a sharper fact than
either of our assertions had.

⇒ **H is weakly favoured by ONE provenance-known case plus an absence of counterexamples — not by
"the distribution."** Its phrase *"unidentified but not unfavoured"* is defensible; the **route** to it
was circular, and a right answer from a circular route will be reused as if the route worked.

⭐⭐⭐ **THE GENERAL RULE: A CONCESSION IS A CLAIM AND NEEDS THE SAME EVIDENCE AS AN ASSERTION.** Both
directions ran past the evidence, both read as rigour, and **neither gets contested** — arguing
someone into being *less* wrong feels like pedantry, so I had to spend a message pushing a claim back
*toward* a peer. **Guards aimed at blame-shedding and at flattery cover neither over-retraction nor
over-confirmation.** Cf. [[feedback_publish_a_claim_as_wide_as_your_evidence]]: the predictive test
discriminates over-retraction *only* — a weaker claim still predicting the data is **not** evidence
the weakening was warranted, which is why I re-derived the branch instead of testing the survivor.

⚠️ **I did NOT re-notify the operator.** The corrected leaning changes no action: the ask (add the
section to my spine) and the gate (criterion 2) are identical either way. ⭐⭐ **An escalation update
that changes no decision is churn that spends the reader's trust** — send the correction that changes
the gate (criterion 1 was unsound), not the one that only refines a hypothesis' odds.

## ⛔ Instrument trap I hit while verifying this

**An empty `grep` followed by `echo "[exit $?]"` reports `0` — that is ECHO's status, not grep's.**
I nearly recorded "no guidance anywhere" as verified from a pipeline whose last command was the echo.
Fixed by capturing `rc=$?` on the line immediately after the grep, which returned **rc=0 with
matches** — the opposite of what the first read implied.

⭐⭐ **Same family as the triager's `&&` failure disclosed on this chain** (`grep -c` exits 1 on zero
matches, so `grep -c X && grep -c Y` aborts after printing the `0` and the controls never run):
**a reassuring exit code answering a different question than the one you asked.** Their framing of
their own re-run is the keeper — **over-determination, not adequacy**: the right answer from a broken
instrument is still a broken instrument.

⇒ **Rules: put `;` not `&&` between control probes; capture `$?` on the very next line, never after
another command; and treat a zero-match grep as unresolved until a non-zero control fires.**

Related: [[project_8373_std430_cbuffer_parser_gate]],
[[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]],
[[feedback_github_comment_hygiene]], [[feedback_publish_a_claim_as_wide_as_your_evidence]].
