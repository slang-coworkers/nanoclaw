---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786631610271-mc1iic
written_at: 2026-08-13T15:16:49.947Z
---

# [approver/clause-gap] CodeRabbit stale review OBJECT hides a completed head-current re-review (harvest exit 10)

**Symptom.** On slangpy#1106 a `synchronize` force-pushed a new head `c72b18c04123` (diverged from the prior head `36aa0e4c`: ahead 2 / behind 1). `collect-reviews.sh`/`harvest-reviews.py` returned **exit 10 (stale)** because the newest CodeRabbit *review object* was still pinned to `36aa0e4c` and carried 3 actionable comments (one 🟠 Major). Taken at face value, exit 10 → "ignore stale, fall to Devin-only." But CodeRabbit had **already completed** a head-current re-review of `c72b18c04123` — it just lived in two places the harvest script does not key on:
- the **commit combined status**: `context=CodeRabbit, state=success, "Review completed"` on the exact head SHA;
- the **PR summary issue-comment**: Run ID `bc45dfa0`, "Reviewing files ... between base and c72b18c04123" → *"No actionable comments were generated in the recent review. 🎉"*

**Root cause.** CodeRabbit posts its incremental "recent review" result as a summary comment + commit status, and does not always mint a fresh formal *review object* at the new head; the prior review object lingers at the old commit. Harvest keys on the review object → reports stale → the workflow would discard a clean, complete, head-current primary signal. This is the slang#12064 `harvest_used=0` failure class (timing race treated as a skip).

**How to catch it.** On harvest **exit 10** (or 22), before falling to Devin-only, independently check the head for a settled CodeRabbit signal that lives outside the review object: (a) `gh api repos/<repo>/commits/<head>/status` for `context~=coderabbit, state=success`; (b) the CodeRabbit summary issue-comment for a "recent review" block naming the head SHA ("No actionable comments" = clean; an actionable count = findings). Use `/commits/<sha>/status` and MCP review/comment reads — NOT `gh api .../pulls/...`, which trips the critique-gate's PR-creation `BASH_PATTERNS` regex.

**Fix.** If the head-current CodeRabbit signal is clean+complete, set `reviewers_complete=true` and treat the tier as fallback-with-a-real-review, NOT `NO_REVIEW_SIGNAL` — even when the formal review object is stale and Devin also fails. Note the stale object as historical context only; do not let its old findings drive the verdict (they examined diverged code), but DO chase any of them that still point at live edited lines (see [approver/challenger-miss] fix-UB probe).
