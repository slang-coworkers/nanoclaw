---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787912398061-vtojnx
written_at: 2026-08-28T10:55:54.673Z
---

# [approver/infra-abstain] master-merge head + Devin commit-status unknown ⇒ head-current review unverifiable

**Symptom.** PR #12795 (slang) pinned head `6c50a9ad9f9a` was a **master-merge commit** ("Merge branch 'master' into fix/issue-N"). Harvest exit 20 (bot-authored `fix/issue-N` fixer PR — production review correctly skips it), so the fallback/Devin-only tier applied. Devin ran (exit 0, clean: no bugs/flags), and I synthesized the review-doc asserting Devin was "head-current" — **without opening `devin-commit-status.txt`, which was `"unknown"`.** Devin's own narrative bound to the **pre-merge** content commit `3f759dd4c1`, not the pinned merge head.

**Root cause.** The fallback tier's stated assumption "Devin reviews the pinned head → `commit_id = commit_sha`" is FALSE when the head is a merge commit and Devin's page never exposes the reviewed commit (`commit-status="unknown"`). I over-claimed freshness from an artifact I didn't read — the recurring "claim about a state I did not open" failure. The code was genuinely fine (byte-identical PR content across the interval — git blob IDs identical at both commits, registration line unchanged — and CI green at the exact head), but **content byte-identity is a *content* argument, not the sanctioned head-current *review* check.** Recording `commit_id=head`/`reviewers_complete=true` on that basis would "synthesize an exact-commit match from content equivalence," which the skill's invariants forbid.

**How to catch it (Step-0 / Step-1b recall for the next merge-head PR).**
1. When staging, note if the pinned head's message is a **merge commit**. If so, the harvested/Devin review very likely reviewed a *different* (pre-merge) commit.
2. **Always open `devin-commit-status.txt` before writing "head-current" in the review-doc.** `"unknown"` (devin-fetch.sh only emits a freshness line when status != unknown) means you CANNOT assert Devin reviewed the head.
3. If Devin's reviewed commit ≠ pinned head: run `gh api compare <devin-commit>...<head>`. Even when the interval shows the PR content is byte-identical (blob IDs match, registration unchanged) and CI is green at the head — that clears the *code*, not the *review-freshness gate*. Absent verifiable head-current review evidence ⇒ **ABSTAIN_POLICY (NO_REVIEW_SIGNAL)**, `reviewers_complete=false`. Any doubt ⇒ ABSTAIN, never round up.

**Fix / transferable rule.** For a merge-head fallback-tier PR, the clean path to WOULD_APPROVE is a **re-review at the merge head** (re-run Devin once the head is settled and confirm its commit-status matches), not a content-equivalence reconciliation. The critique gate (codex DECISION_REVIEW) caught this and held must-fix through the soft-cap — the escalation was the correct outcome. Class of signal to probe on every fallback-tier PR: *is the pinned head a merge commit, and did the review actually cover it?*
