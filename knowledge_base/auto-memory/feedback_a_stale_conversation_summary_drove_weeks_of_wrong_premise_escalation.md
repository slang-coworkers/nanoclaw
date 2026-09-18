---
name: feedback_a_stale_conversation_summary_drove_weeks_of_wrong_premise_escalation
description: "On a long multi-day GitHub chain my conversation summary froze at an early point; I drove ~2 weeks of operator escalation (parked-on-budget, fund/defer, 'rework already happened', 'CLA blocks merge') all premised on stale state, re-litigating work already resolved on live GitHub. The summary is NOT authoritative for external state across gaps — verify pivotal chain-state against LIVE GitHub before escalating, authorizing spend, or relaying up."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: bd9f1bc2-8693-45b5-8691-bd3467627313
  modified: 2026-09-17T14:27:46.409Z
---

⛔ **TRIGGER: any decision that depends on "what is the current state of X on GitHub" (PR merged? reply posted? head SHA? open asks? CLA?) AND there has been a multi-day gap since my last activity on this chain. Before escalating to the operator, authorizing spend, or relaying "done/already-happened" up — re-query LIVE GitHub (`gh api` / MCP). The conversation summary is frozen; it is not a source of truth for external state.**

**shader-slang/slang #12604 / PR #12608 (Aug–Sep 2026).** Chain `orchestrator → triager → fixer`. My conversation summary froze at the **Aug-31 maintainer comment**. A full rework + a substantive maintainer reply were posted **Sep-12** (`issuecomment-5646649059`) that my context completely missed. On that stale premise I:
- escalated to the operator repeatedly that the PR was **"parked on your budget decision / fund-or-defer the rework,"** across ~2 weeks and multiple messages, when the rework had largely already been done and replied;
- told the operator **"the rework already happened Sep-12, so funding is moot"** — inaccurate on two counts: the Sep-12 *comment* existed but its code was **never pushed** to origin (`6479ff2ea3` was local-only; origin head `0fd3b1cece` still had the pre-rework design), and funded rework *was* in fact still needed;
- relayed a soundness concern as "modestly strengthens fund+proceed," which then got walked back as "not a new hole," then the maintainer re-raised it as a principled-completeness blocking ask — three oscillations, each following a coworker relay that was **itself running on the same stale summary**;
- flagged the CLA as **"blocks merge, needs operator action"** — it was a *soft* `license/cla` check the maintainer simply **merged past** (never signed).

**Root cause — two compounding facts:**
1. I treated the conversation summary as current. Across a multi-day gap it is frozen at whenever it was last cut.
2. **Cross-checking with a peer did NOT catch it** — the triager AND the fixer had resumed from the *same* stale summary, so all three of us re-litigated already-resolved state in lockstep. A peer agreeing is not corroboration when the peer shares your stale input. (Contrast ANCHOR A, where a peer on a *different edge* is the check.)

**What ended the loop:** the fixer read its **memory file + live GitHub** (authoritative), found the Sep-12 work already posted, and said so. Every correction after that came from me re-querying live GitHub (`gh api repos/.../issues/comments/<id>`, `.../pulls/12608 --jq .head.sha`, comment timeline, commit statuses) rather than the summary. Once I did that per pivotal claim, the picture stabilized and stayed correct through merge.

**How to apply:**
- ⭐⭐⭐ **On any chain with a multi-day gap, LIVE GitHub is the source of truth, not my summary and not a coworker relay.** Before escalating/authorizing/relaying a state-dependent claim, verify it with a read this turn: PR merged? head SHA? latest comment + its author? open review asks? check statuses? One `gh api` call per pivotal fact.
- ⭐⭐⭐ **A peer confirming your framing is worthless as corroboration when the peer resumed from the same stale summary.** The tell: the whole chain re-deriving something that live state already settled. Re-query the *external artifact*, not another agent's memory of it.
- ⭐⭐ **"Already happened / done" is a state claim — verify the ARTIFACT, not the report of it.** A posted *comment describing* a rework is not the *pushed code*; a `Fixes #N` in a body is not a *merge*; a pending check is not a *hard block*. Read the actual push/merge/status.
- ⚠️ **Temporal analog of ANCHOR C:** ANCHOR C is "one path names a different object per *edge*"; this is "one summary names a different world per *point in time*." Same discipline — re-measure at the moment of use. See [[feedback_a_relay_names_an_inbound_that_must_exist_in_the_thread]] (don't relay unverified state) and [[feedback_a_control_validates_the_instrument_never_the_target]].
- Non-loss note: no external damage resulted (nothing wrong was posted to GitHub; the duplicate courtesy reply I authorized was caught and held before posting), but I spent ~2 weeks of operator attention and my own credibility on wrong-premise escalations. The cost was real even though the artifact stayed clean.
