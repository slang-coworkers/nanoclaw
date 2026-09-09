---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788137600490-lkljc6
written_at: 2026-09-02T23:04:12.575Z
---

# [approver/clause-gap] tier_eligible line/file caps count mechanical test-migration churn as substantive, abstaining large-but-simple PRs regardless of a clean verdict

**Symptom.** shader-slang/slang#12836 ("Normalize GLSL source language selection") abstained on BOTH reviewed revisions with `CLAUSE_FAIL:tier_eligible` under v0-shadow (rev f965477c194b: 2398 lines / 222 files; rev ecd23047e651: 2634 lines / 232 files — caps are 400 lines / 30 files). Every other clause passed on both (MEMBER author, same-repo head, commit_match, CI green, no protected paths). Between the two revisions the primary bot review verdict flipped from 🟡 "Has issues — 0 bugs, 3 gaps, 4 questions" to ✅ "Clean — 0/0/0" (author added the linked-GLSL-module tests and removed the null-`m_translationUnitRequest` deref), yet the second decision was still a size abstain — the challenger never ran either time, so the approver produced ZERO agreement signal on a PR whose review actually converged to clean.

**Root cause.** `eval-clauses.py`'s `tier_eligible` sums `additions+deletions` over ALL changed files and counts ALL files, with no notion of substantive vs mechanical churn. This PR's line/file count is dominated by ~200 mechanical test-file migrations (`-allow-glsl` → `-lang glsl` / `import glsl;`) plus docs; the actual substantive source diff (the front-end language-resolution + IR-gating changes the review reasoned about) is a small fraction. The cap can't tell them apart, so a bulk-rename/migration PR trips it as hard as 2600 lines of new compiler logic.

**How to catch it.** When a PR abstains on `tier_eligible` but the harvested bot review is clean/near-clean and the changed-file list is dominated by `tests/**` renames or generated/doc files, recognize this is the coarse-cap case, not a genuinely risky large change. The shadow approver structurally cannot score this class of PR — worth flagging to the operator as a policy-tuning candidate, not treating as a one-off.

**Fix (policy-tuning candidate, needs human sign-off — approver never self-widens).** Consider a `tier_eligible` that weights or excludes mechanical churn: e.g. compute substantive churn as lines outside `tests/**` and generated/doc paths, or add a separate (higher) cap for test-only lines. Until then, expect bulk test-migration PRs to always land `CLAUSE_FAIL:tier_eligible` regardless of review verdict, and they are excluded from agreement scoring. Reason_code is Policy (system working as intended), not infra — no infra gate impact.
