---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787873078405-moeqgc
written_at: 2026-08-28T00:12:56.045Z
---

# [approver/critique-mustfix] DECISION_REVIEW comment-hygiene on the AUTHOR's source can force an unresolvable must-fix → ABSTAIN:CRITIQUE_MUSTFIX

**Symptom:** On shader-slang/slang#12182 my on-merits decision was WOULD_APPROVE (no 🔴 bug; both 🟡 gaps cleared). But the DECISION_REVIEW critique (codex, /codex-critique) held a must-fix across 3 rounds on **comment hygiene in the AUTHOR's PR source** (a deliberate TODO in the OptiX unit test; a restating comment at slang-emit-cuda.cpp:512; two restating comments in callable-entry-point-params.slang:28/35). The codex reviewer developer-instructions include a "comment hygiene when a code diff is under review → must-fix" clause, and codex applied it to the PR diff.

**The bind:** the approver's decision enum is CLOSED {WOULD_APPROVE | ABSTAIN_POLICY | BLOCK}. These nits are NOT a 🔴 bug (no BLOCK) and NOT an uncertainty/blast-radius OPEN_GAP (codex agreed). SKILL.md says WOULD_APPROVE requires the full Steps-1–4 conjunction clean, and an unresolved DECISION_REVIEW must-fix ⇒ "revise or ABSTAIN" (SKILL.md:161). The approver **cannot revise** — hard invariant: never write to GitHub, never edit PR source. So the only reachable state is **ABSTAIN_POLICY reason CRITIQUE_MUSTFIX**. Recorded that.

**Root cause / procedure question:** the DECISION_REVIEW critique input is meant to review MY DERIVATION (clauses from data, verdict parse vs review doc, source tier), NOT to re-review the author's code style. When codex re-tiers a comment that the production merge-gating reviewer (`github-actions[bot]`) itself logged as 🔵-advisory into a must-fix, it manufactures an abstain the approver cannot clear in-role — a likely FALSE ABSTAIN (a human may merge unchanged).

**How to catch / fix (for next time):** (1) In the DECISION_REVIEW prompt, scope the ask explicitly to the derivation and be clear the approver cannot edit PR source — style nits about the author's code should be returned as *advisory*, not must-fix. (2) Do NOT override an independent reviewer's persisted must-fix to force an approve — the gate exists so the approver isn't sole judge; abstain and surface loudly instead. (3) This abstain MUST be joined against the human outcome: if the PR merges unchanged, it is an `[approver/false-safe]`-adjacent false abstain and evidence the DECISION_REVIEW scoping needs tightening. Watch join on #12182 @2aa956023c8e.
