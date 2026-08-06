---
name: feedback_a_closing_summary_can_retrigger_the_routing_it_describes
description: "A terminal-state summary restates the trigger vocabulary of the work it closes, so content-based auto-routing can re-fire the workflow it was reporting complete. The recipient must re-derive completion from artifacts; on a closed chain, re-walking the workflow is the regression."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9691818c-a06b-4116-aa1d-5de29d747147
---

# A closing summary can re-trigger the routing it describes

**2026-08-05, slang#6471. Observed on the triager; caused by MY closing summaries.**

## The incident
#6471 was terminal on both sides. I sent a final-state summary naming the issue, the subsystem, the
fix site, the test gap, and the resume trigger. **The triager's auto-route fired on that content** and
dispatched `/slang-triage-issue` — the very workflow it had already fully walked.

It did not re-walk it. It enumerated all 11 steps against live artifacts, found 1-9 done and 10-11 as
*the held state*, and named the concrete regressions re-running would cause:
- **step 9 (post on the issue)** → a duplicate bot comment stacked on a maintainer's issue
- **step 8 (forward to fixer)** → a fixer dispatched against two open, maintainer-owned design
  questions

⇒ correct response was to recognize the work as complete and take **no action**.

## ⭐⭐⭐ The mechanism
**A closing summary is maximally trigger-shaped by construction.** To be a useful report it must
restate the issue number, the subsystem, the file:line, the verdict, and the next step — which is
*exactly* the vocabulary a content-based router matches to decide "this is triage work." **The better
the summary, the more it looks like a fresh task.** Terminal-state reports are therefore the highest-
risk input to any content-routed dispatcher, and the risk rises with report quality.

⇒ ⭐⭐**COROLLARY FOR ME: my closing summaries are not free.** Each one is another chance to wake a
coworker into a completed workflow. On a chain both sides have declared terminal, prefer sending
NOTHING over a well-formed recap — the recap has a cost that the silence does not. This is the same
family as *narrating a non-reply is a reply*
([[feedback_narrating_a_non_reply_is_a_reply]]), one layer up: not just noise for a reader, but a
routing event for a machine.

## ⭐⭐ The recipient-side rule
**Arrival of a dispatch is not evidence that work is outstanding.** A router matches text; it cannot
read the ledger. So the receiving tier owes a **completion check against artifacts before executing**,
and the check must be per-step, not a vibe:
- enumerate the workflow's steps,
- for each, name the live artifact that proves it done (comment id, memo path, label state),
- for any step that is *deliberately suppressed*, say why the suppression still holds,
- **name what re-running would break** — that is what converts "seems done" into "re-running is a
  regression."

⭐**"Correctly suppressed" is a state worth recording explicitly.** Step 8 was skipped on purpose
(design-gate + needs a new owner). Without that note, a fresh session reading the record sees a
missing step and re-dispatches — an omission and a decision look identical in a step list. Sibling of
PENDING vs UNRUNNABLE in
[[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].

## Instrument note
Verified new to my store before filing: collapse-and-squeeze regex for
*closing-summary/restatement → re-fire/auto-route* → **NONE**; broadened *router fired on restated
content* → 1 hit (`project_nanoclaw_pr878…`), read and **not a match** (a `pr_ready_for_review`
webhook on a prose-only PR — event-based, not content-based). Controls: `auto-rout` → 12 files
(non-zero), fresh token `wk9zrtabsent0805` → 0.

Chain: [[project_6471_combined_sampler_register_space]].
