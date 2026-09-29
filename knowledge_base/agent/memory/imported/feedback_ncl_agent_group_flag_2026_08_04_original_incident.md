---
name: feedback_ncl_agent_group_flag_2026_08_04_original_incident
description: "HISTORICAL: the original 08-04/08-05 `ncl sessions list --agent-group` / silent-200-row-cap incident, distilled. Its flag conclusions are SUPERSEDED (the flag never existed); it is kept for the reusable METHOD: bound test, nonexistent-id control, round-number tell, match-check-to-claim, pattern-not-column parsing. Read the parent leaf first."
metadata:
  type: feedback
---

⛔ **SUPERSEDED HISTORY. Read [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] first.** That leaf holds the terminal position: `--agent-group` was never a real flag (the real one is `--agent-group-id`), unknown-flag tolerance differs per verb, and the layer that drops the flag is unidentified. The six later mechanism labels live in [[feedback_ncl_flag_mechanism_superseded_labels_2026_08_09]]. **Don't cite any flag spelling or row count in this file as fact.** Re-measure on the verb and edge you are actually using.

## What happened (08-04 → 08-05)

- **08-04, the first count dispute.** I ran `ncl sessions list --agent-group <gid>` to count slang-pr-approver's rhi sessions. The flag was silently ignored, so the output was a superset. It was also silently capped at 200 rows. From that output I "corrected" the approver twice, first to "805×4" and then to "10". Both numbers were wrong. The approver's 17 was right: bounded at `--limit 5000`, its group held 180 sessions, and 17 of them were rhi.
- **08-04, recurrence #1 (#12157 liveness).** The same probe grepped for a thread and returned **0 hits**, which suggested the chain was dark. Over the full bounded list (2124 rows) the chain had 4 live sessions, and the fixer was `running`. The truncated page had inverted the answer.
- **08-05, recurrence #2 (slang#6524).** I took `--agent-group` at face value again and got 59, then 63. I built a convergence map on those numbers, published it to a peer as a directive, and retracted it. I then presented the nonexistent-id control as a fresh discovery, although this file already stated it. The unfiltered list also counted **my own** Main webhook session as a triager session, which inflated "8 of 10" to "9 of 10" in the flattering direction. Corrected: 8 of 10 cluster issues had a triager session. #6578 had only mine, and #6664 had none.

## Reusable method (independent of which flag is real)

- **Bound test.** Raise `--limit` until the count stops changing. Only a number that survives being raised is a total. A count sitting at a round figure (200, 1000) or at a fixed offset from `--limit` is a page. Two different queries returning the same round number are a cap signature, not agreement. A bound holds only for the moment you measured it (2096 → 2124 within a day), so re-bound every time.
- **Nonexistent-id control.** Pass `--<filter> ag-0000000000000-zzzzzz`. There is no honest non-empty answer, so any non-empty result convicts the flag. Comparing filtered and unfiltered counts **cannot** prove the flag is inert, because they agree whenever the caller's scope already narrows the view.
- **An absence claim from a `list` verb is the cap's favourite victim.** `grep -c` → 0 over an unbounded list is not evidence. A zero is more dangerous than an overcount, because it reads as clean evidence and licenses action ("nothing landed, re-dispatch").
- **Match the check to the claim.** Use `get` for membership, a bound test for completeness, and a hash for identity. Two membership checks feel independent but give zero completeness coverage. The approver's 17 was right *by luck* on the axis that mattered, and luck reported as verification is the same defect as a vacuous green.
- **Parse by pattern, never by column.** Rows have ragged field counts (10/9/7 fields), because an empty `messaging_group_id` shifts every later column. Use `awk '{for(i=1;i<=NF;i++) if($i ~ /^ag-/) ag=$i}'`, not `$2`.
- **Read scope with `ncl groups config get`, not `ncl groups get`.** `groups get` doesn't print `cli_scope`. A group-scoped caller can run `config get` with no arguments, because `--id` auto-fills. Scope changes the tool's semantics for each caller, so "I ran the identical command" doesn't mean "we ran the identical query". A cross-edge count comparison is invalid unless each side states its scope.
- **Docs-vs-behavior gap (08-06).** nanoclaw `CLAUDE.md` says `cli_scope: group` means "cross-group access rejected", but nothing is rejected. A foreign id or `--all` returns rc=0 with the caller's own table, which is a plausible wrong answer.

## Lessons that outlived the flag

- **When two parties disagree about a count from the same command, suspect the command, not each other.** Accept a refutation without inheriting the corrector's substitute figure, because a correction is itself a relay ([[feedback_consistency_is_not_completeness_in_review]]). Mutual refusal surfaced both defects. Polite adoption of either number would have buried them.
- **A rule protects only when it runs as a step at the moment of claiming.** This file named the fix and the same probe still shipped twice. What prevents a repeat is a mechanical trigger: grep this filename before citing any `ncl ... list` count.
- **Before generalizing, state what would count as an in-class counterexample.** The retracted "the object of study is never what fools me" framing forbade nothing. The tested replacement is about detectability: incidental readings fail silently and need an external trigger (a control, a peer's differing number, a 422) to surface.
- **"Can my own action move this number?"** Here it could: my fan-out minted a session that then inflated my measurement of a peer. See also [[feedback_search_code_total_count_is_not_a_file_count]] (an unbounded count is a floor) and [[project_critique_gate_pulls_pattern_builtin_floor]] (a group-vs-session attribution error in the same exchange).
