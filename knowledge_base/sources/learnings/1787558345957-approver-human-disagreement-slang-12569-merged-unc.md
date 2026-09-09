---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786957699438-ha65lx
written_at: 2026-08-24T07:59:05.957Z
---

# [approver/human-disagreement] slang#12569 merged unchanged at my ABSTAIN head — a proven concern that never reached the PR can't block a merge (over-abstain in the falsifiable sense, but the bug shipped)

**Outcome:** shader-slang/slang#12569 (`cloneInst` dedup-hit guard, Fix #12540) MERGED unchanged at `eafe1b4accf6` — my exact ABSTAIN_POLICY:CHALLENGER_CONCERN head, 0 interval commits, squash `8dcc35a4`, by author jkiviluoto-nv. I had EMPIRICALLY PROVEN (built the guard, ran it) that the fix silently miscompiles a *transforming* forwarding extension (`tag.getValue()+1` → dispatch returns 42 not 43; pre-fix it errored loudly E99997). No BLOCK — the delivered program was green and the bad variant hadn't compiled before, so "loud-error→silent-miscompile is a regression in kind," a maintainer call.

**How to score it (honestly, both ways):**
- Against the FALSIFIABLE reading of a CHALLENGER_CONCERN abstain ("material enough not to merge as-is"): the PR WAS merged as-is ⇒ my abstain is REFUTED as a merge-blocker ⇒ this counts as an OVER-ABSTAIN / human-disagreement, NOT agreement. Do not launder it as "human looked, a human looked."
- BUT the technical finding was TRUE and remains true: the silent miscompile is now shipped in master. The merge does NOT vindicate the code; it tells me the concern didn't clear the "block a merge" bar. Two facts coexist — record both, round up neither.

**The decisive nuance (the transferable lesson):** my counterexample NEVER REACHED THE PR before merge. Timeline: orchestrator routed it to a GitHub-writable reviewer for independent repro at ~14:24Z; PR merged ~16:23Z (~2h); the only issue comment on the PR was CodeRabbit's. So the maintainer did NOT weigh-and-reject my concern — they merged WITHOUT SEEING IT. That reframes the outcome: this is less "human disagreed with my analysis" and more "a correct, proven analysis produced ZERO effect because it didn't reach the decision-maker in time."

**Rule for a read-only approver:** when you hold an empirically-proven concern that a SILENT MISCOMPILE is about to ship, a routed hand-off for "independent reproduction" is too slow/uncertain to beat a merge — the value of the measurement is lost if it doesn't land on the PR before merge. Escalate proportionally to the severity and the merge risk: (a) flag the merge-imminence explicitly to whoever CAN post, with the ready-to-paste counterexample, not just the finding; (b) ask them to post FIRST and verify later if the window is short; (c) surface to the human operator directly when a proven silent-miscompile would otherwise ship unremarked. A perfectly correct abstain that arrives after the merge is indistinguishable from no abstain at all.

**Follow-up owed (flagged to orchestrator, not mine to file — read-only):** master now carries the introduced silent-42 miscompile for transforming enum→tag forwarding extensions; the issue triage's root fix (identity-layer dedup + duplicate-key assert) is still absent. Worth a tracking issue.

**Not a false-safe:** I abstained on a real bug (opposite of a false-APPROVE). Filed as human-disagreement per the Step-4 taxonomy.
