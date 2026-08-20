---
name: feedback_a_fact_that_lets_you_stop_investigating_is_load_bearing
description: "The claim that closes an investigation is the one nobody checks — the mechanism is relief, not carelessness. Execute it before banking it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: baf82ad3-7841-42bc-bf70-27788373bde6
---

# A fact that lets you STOP INVESTIGATING is load-bearing and unverified — execute it before you bank it

**2026-08-05, slangpy#1091.** Three passes, three corrections, and **both** substantive catches landed
on the claim its own author had scrutinised *least*. Not randomly — the two waved-through claims were
each the one that let their author stop working:

| author | the claim | what it bought them | verdict |
|---|---|---|---|
| triager | "torch caps rank at 64, so the native bound never rejects a constructible tensor" | issue is latent ⇒ P3 ⇒ closeable | **refuted** — that 64 is a per-*operation* guard; rank 65/70/100 all construct |
| me (Main) | "the fallback's actual-length rule is the correct one" | fix direction obvious ⇒ decision made | **over-reached** — which side is the defect turns on an unanswered product question |

## The mechanism is RELIEF, not carelessness

This is why "be skeptical of claims you agree with" doesn't fire: the feeling isn't agreement, it's
*resolution*. A fact that dissolves tension gets waved through by whoever benefits from the
dissolution. It reads as progress. Disputing it feels like manufacturing work.

**The practical tell** (triager's framing, better than mine — it names the felt signal at the moment
it fires rather than the epistemic category afterwards):

> When a fact arrives that means you can **stop investigating**, that fact is load-bearing and
> unverified. Execute it before you bank it.

Actionable where "verify what you agree with" is not, because you can notice relief in real time.

## Corollaries earned on the same chain

- **A claim that LOWERS severity gets less scrutiny than one that raises it** — and it's the more
  dangerous direction, because low severity means nobody looks again. Same family as
  [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]].
- **Zero-margin arithmetic is a finding, not a pass.** rank 64 needed exactly 128 against 128
  available. "It fits" concealed that the bound was `<` not `<=` and that `128 = 64 + 64` was
  coincidence, not derivation. When a bound holds by 0 at the edge of an *assumed* range, the
  assumption is the finding.
- **Confirm an artifact is WRITABLE before promising a fix.** I told the triager to set a P2 label in
  a repo with no P0–P3 labels; then hit `EROFS` trying to apply the workflow patch myself and nearly
  reported it done. Both parties earned this rule from opposite directions in one chain.
- **Scope a defect by grepping the population, not by the instance that bit you.** The triager filed
  the step-9 workflow defect as *theirs*; it was in **both** triagers. Same narrowness as reading an
  artifact list off whichever step was in front of you.
- **Resolve a line citation against the ref the CITER was working on.** The triager nearly flagged a
  correct `test_torch_bridge.py:193` cite as wrong by checking `main` for a post-change line on the
  fixer's branch. The asymmetry is what matters: the mistake **in reverse** — checking their branch
  for a claim about `main` — *confirms* a wrong citation (a false negative that publishes) rather
  than falsely flagging a right one (a false positive caught while drafting).

## Why this chain is a success, not an embarrassment

The corrections-per-pass count is the feature. The issue was opened by a coworker with a confident
repro that was arithmetic, in an unmerged format, never executed — and it closed on the discipline
whose absence opened it (the fixer splitting evidence provenance unprompted, attributing rank-65
construction to triage rather than claiming a repro it couldn't run). Each pass narrowed the truth and
every correction was published with an execution log.

## Same-session recurrence — 2026-08-19, same issue, the framing version

Two weeks later a maintainer (`kaizhangNV`) landed on the parked #1091 and wrote a "short summary"
that framed the open question as a **binary**: *"support tensors above rank 64? if yes… if no…"*.
I dispatched the triager to "price both branches" and the triager posted an accurate two-branch
reply. **Both of us walked past comment 3 (`5191752072`), which WE had authored on 08-05** — it
established a richer four-option frame the binary discards:

- the failure is a **bounded band (rank 65–116)**, not open-ended — it agrees again (on an error) at ≥117
- **Option A** (make the native guard exact) makes the two bounds *the same quantity at every rank*,
  resolving the divergence **whether or not** rank>64 is supported — i.e. the product decision is not
  the gate for closing the P2, only for the diagnostics quality
- a legitimate **Close** option (nothing in-tree observes it)

The maintainer handed us the *cleaner* framing (a binary), and we both took it — one turn after I
recorded this very learning. That is the pattern exactly: **a simpler framing gets waved through
because it resolves the shape of the problem, and re-presenting someone's own simplification back to
them feels confirmatory while discarding analysis already done.** The tell would have been: *before
answering the question as asked, does our own prior record frame it differently?* Neither of us
re-read our comment 3 because the binary was clean and the maintainer had blessed it.

Not an error in the reply — it answered the question asked, and comment 3 was on the thread. The miss
was **under-inclusion of our own best prior analysis**, and it was mine as much as the triager's (my
dispatch said "both branches"). Fix carried forward: when a maintainer next engages, anchor on comment
3's A/B/C/Close checklist, not the re-derived binary.

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_correction_unapplied_until_every_restatement_fixed]] ·
[[feedback_a_true_claim_that_widens_past_its_evidence]]
