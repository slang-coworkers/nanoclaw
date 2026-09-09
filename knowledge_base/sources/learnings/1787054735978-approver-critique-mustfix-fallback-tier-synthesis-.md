---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787052279959-u9xvw9
written_at: 2026-08-18T12:05:35.978Z
---

# [approver/critique-mustfix] Fallback-tier synthesis: count findings the reviewer reported, don't pre-net the challenger's clear into gaps=0

**Symptom.** On slang#12601 (docs-only +2/−2, fallback tier: CodeRabbit COMMENTED + Devin clean, no github-actions[bot] primary), CodeRabbit reported "Actionable comments posted: 1" (a 🟡 macOS brew-path nit). I judged that nit pre-existing/out-of-scope and — at *synthesis* time — wrote the embedded result `"gaps": 0`. DECISION_REVIEW returned must-fix: "gaps: 0 contradicts the documented 🟡 actionable gap." Fix was `gaps: 1` with the challenger clearing it as pre-existing; verdict (WOULD_APPROVE) unchanged.

**Root cause.** Two separable steps got collapsed into one number. Synthesis (Step 1b / Step 2) should count what the reviewer(s) *reported* — CodeRabbit's "Actionable comments posted: N" maps to N gaps; Devin bugs→🔴, flags→🟡. The challenger (Step 3) then *clears or holds* each 🟡 on severity, recorded in the gap **disposition**, not by editing the count. Writing `gaps: 0` because I'd already decided to clear it pre-nets the posterior into the prior and destroys auditability: a reader can't tell whether the reviewer found nothing vs. found something I cleared. (Related but distinct from the "don't append challenger findings *into* review-doc.md" laundering learning — here the doc wasn't contaminated; the count itself was under-reported at synthesis. Both surface as a suspicious gaps:0-vs-1.)

**How to catch it.** Before writing the embedded `_approver_result`, ask: *does this count match what the bot body literally says it found?* CodeRabbit's "Actionable comments posted: N" is the ground-truth gap count for its tier — transcribe N, don't reduce it by your own clearing judgment. The clear lives in the challenger's per-gap disposition ("pre-existing / out-of-scope / trigger-unreachable"), which the skill reads separately. A gaps:0 sitting next to a review body that says "Actionable comments posted: 1" is the smell.

**Fix.** Synthesis counts reported findings verbatim; challenger clears in the disposition field. Then the ledger's challenger JSON carries both `"gaps": 1` and `"gap_disposition": "...cleared as pre-existing..."` — the audit trail shows a reviewer flagged something AND why it didn't block, instead of hiding the flag. Verdict mapping (APPROVE_WITH_NITS) is orthogonal to the count and stays correct either way.
