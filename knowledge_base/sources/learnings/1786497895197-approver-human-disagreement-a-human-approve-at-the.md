---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453650870-pwn340
written_at: 2026-08-12T01:24:55.197Z
---

# [approver/human-disagreement] A human APPROVE at the exact ABSTAIN_INFRA head scores the RECOVERED READ, not the abstain — and here the read matched

# [approver/human-disagreement] A human APPROVE at the exact ABSTAIN_INFRA head scores the RECOVERED READ, not the abstain — and here the read matched

**The join.** shader-slang/slang#12459 @`c507078f64aa`: I decided **ABSTAIN_INFRA:NO_REVIEW_SIGNAL** (the production review crashed mid-aggregation, `ir-correctness-reviewer` never returned, Devin empty). ~17h later **jvepsalainen-nv (MEMBER) APPROVED "LGTM" at the exact same commit** — `commit_id` verified `== c507078f64aa`, no interval commits, so no wrong-commit join risk. PR still OPEN (not merged).

**Why this is NOT scored as agreement OR false-safe.** `ABSTAIN_INFRA` is orthogonal to the merge question: it fired because my *measurement pipeline* broke, not because of anything about the code. The human approving neither confirms nor refutes "the review harness failed to produce a complete signal at this head" — which was simply TRUE. So the honest calibration is: **the abstain was infra-correct, and it does not enter agreement scoring.** (This is the one abstain class the retracted "exclude abstains" rule was actually right about — but only because its falsifiable reading is genuinely about *my pipeline*, not about the PR. Contrast ABSTAIN_POLICY, whose reading *is* "material enough that a human must look", which a clean approve can refute.)

**What the join DOES score: my recovered substantive read.** Because I mined the crashed review's CI job log rather than recording an empty abstain, I had also formed a real assessment: no verified 🔴 (the one reported 🔴 was hedged and I refuted it from source — `IRInst::typeUse` is a real `IRUse` so `replaceUsesWith` is not stale), remaining findings gap-level. **The MEMBER's clean approve at the same head is consistent with that read.** ⇒ *When you abstain on infra but still do the substantive work, the later human verdict validates your READ even though it can't score your DECISION.* This is direct payoff for the "mine the crashed review log, don't hand over an empty page" rule — the recovered read was the correct one.

**A weak, honestly-caveated gap-severity data point.** I carried forward a criticality-5 test gap (the widen test can't distinguish new from old lowering — a revert stays green) and a diagnostic-bypass concern (the fast path returns before `canTypeBeStored`, unexercised on VK/Metal/WGSL). The approve was a bare "LGTM" — so I **cannot** tell whether the maintainer weighed those gaps and judged them immaterial or simply didn't surface them. **One "LGTM" is not evidence that a gap class is safe.** Do NOT downgrade the byte-identical-test-gap severity on the strength of this; record it only as: on this shape (a representation-only IR-lowering change with a partial real control test), a MEMBER approved without addressing the coverage gaps. Needs corroboration across more joins before it moves a severity call.

**Mechanics confirmed on this join (both from prior learnings, re-verified live):**
- `record_human_verdict` is **unregistered** — do not call it; the host auto-stamps the verdict from the `pr_review` webhook keyed by delivery id. The SKILL.md instruction to call it is stale.
- Here there was **no row to stamp onto anyway**: the original `record_decision` was denied host-wide (`APPROVAL_LEDGER_WRITERS` unset), so the auto-join has nothing to attach to. **An unrecorded decision cannot receive its human join** — the ledger outage doesn't just delay recording, it silently drops the calibration join too. That raises the cost of the outage: every denied append is also a lost human-verdict datapoint.

**Nudge-premise note.** The supervisor nudge said "coderabbitai commented last." True by raw comment timestamp only because CodeRabbit's *bot summary* is an issue-comment while the human's signal is a *review*. The newest **substantive** event was the human APPROVE. A bot-authored comment is not a routing inbound; ranking "who spoke last" without splitting bot-vs-human and comment-vs-review inverts exactly this.
