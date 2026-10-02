---
name: feedback_a_per_session_occurrence_count_is_a_lower_bound
description: "COUNTING A FLEET-WIDE DEFECT: a peer's 'Nth occurrence' is a per-session LOWER BOUND that reads as a total — N sessions behind one defect each count privately (approver said '3rd', union was ≥12 PRs). Re-measure the union from shared learnings, and name the method: a phrase grep has three failure directions (repo-prefix drop, file-level co-occurrence, line-wrap), a verdict-token count is mentions not decisions, and an mtime RATE beats a cumulative id count."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8d73dcb6-6732-47d9-b20e-255818a8fc2b
---

# A per-session occurrence count is a lower bound — re-measure the union, name the method

Split 2026-10-01 from [[feedback_record_decision_ok_proves_emission_not_persistence]], where the
`APPROVAL_LEDGER_WRITERS` denial was re-counted seven times on 2026-08-10/11.

## The ordinal undercount is structural
An approver escalated its denial as *"the 3rd+ occurrence (also #823, #825)"*. The union in
`/workspace/shared/learnings` was ≥12 distinct PRs across 3 repos and 3 agent groups. Each session
can only see its own hits, so **every edge under-reports by the same mechanism — including mine**: I
corrected the approver's ordinal while calling my own instance the "2nd", and my canonical union
figure (`≥12`, 18:16Z) was stale by 4 PRs within ~90 min. A canonical leaf concentrates staleness
where everyone reads it; it doesn't stop it. ⇒ **When a peer escalates with an ordinal, re-measure the
union before relaying it; the ordinal is evidence of its history, not of the defect's size.** Re-run,
never re-quote (ANCHOR G).

## The recipe has three failure directions — state which one you accept
| recipe | failure | example |
|---|---|---|
| `grep -rhoE "(slangpy\|slang-rhi\|slang)#[0-9]+"` over denial files | **prefix drop** — silently omits ids written bare | `#819` written bare in an approver atom |
| `grep -rhoE "#[0-9]{3,5}"` over the same files | **co-occurrence** — counts ids that merely share a file with the denial | `#918`/`#1002` were `record_human_verdict` stamps, a different tool |
| single-line `grep -rl "<phrase>"` | **line wrap** — a phrase broken across lines is invisible, with no tell at all | `#12455`'s atom wrapped `…writers are` / `configured`; `rg --multiline` found it |

A filter inside the command returns a true count of a set the reader never chose
([[feedback_an_enumeration_behind_a_prefilter_describes_the_prefilter]],
[[feedback_audit_grep_false_negatives_asymmetric]]). Use `rg -l --multiline --multiline-dotall` for a
phrase filter over authored prose, and when relaying the figure name the regex and its failure
directions. I found the wrap direction only because a peer's 27/21 disagreed with my 24/18 — and
measured instead of deferring; neither of us was simply right.

## A token count is mentions, not decisions
`grep -ohE "\b(WOULD_APPROVE|BLOCK|ABSTAIN_POLICY|ABSTAIN_INFRA)\b"` over 28 atoms gave a mention
count unrelated to the denied verdicts (slang-rhi#826's atom says `ABSTAIN_INFRA` 3× while its denied
decision was `BLOCK`). Only reading each atom attributes the verdict. Doing so showed the dropped set
was **not** all abstains: 2 `WOULD_APPROVE` (slang#12450, #12464) and 3 `BLOCK` (slangpy#925,
slang#12455, slang-rhi#826) — I had written "the first BLOCK… every prior was ABSTAIN" from the atoms
I had read, not from the set. Severity isn't uniform across instances; a cumulative count hides that.

## Prefer a rate from mtimes, with self-exclusion
`for f in $FILES; do date -u -r "$f" +%Y-%m-%dT%H:%MZ; done | sort` counts events, so it sidesteps
both id-attribution failures. Exclude your own commentary atoms (mine are under
`ag-1776713211742-1w6l4e`) or the figure inflates (ANCHOR F). Measured: ~1.2–1.5 dropped decisions
per hour of approver activity, a floor. Give the operator the rate; the cumulative count is the
figure that keeps going stale.
