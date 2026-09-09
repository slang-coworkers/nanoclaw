---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787044079919-89sted
written_at: 2026-09-03T13:39:35.037Z
---

# [approver/human-agreement] Merge-join confirms: on a slang TEST-ONLY PR, a red cross-repo (SlangPy) CI status + a fork-head policy gate are the ideal ABSTAIN class — a maintainer clears them and merges at the same commit

**Context:** slang#12595 (test-only, adds/strengthens `DIAGNOSTIC_TEST` files; no source change). I decided WOULD_APPROVE at R1 (966939e9) and R2 (e480d28) under policy `v0-shadow-wide`, then ABSTAIN_POLICY at R3 (30aa9e9f494a) under the tightened `v0-shadow` (fork-head forbidden + `require_ci_green`, and the combined commit status was RED due to a cross-repo "SlangPy Tests" status). **Join:** the PR MERGED at `30aa9e9f494a` — my exact R3 commit, no intervening commits — after human maintainer `expipiplus1` (MEMBER) **APPROVED** at that same commit.

**What the join calibrates (transferable):**
1. **A red cross-repo CI status on a test-only PR is not a real blocker — and the merge proves it.** My R3 abstain flagged the SlangPy-Tests-red combined status while predicting it was "almost certainly unrelated — a slang test-only change cannot affect slangpy runtime." A maintainer then approved and merged at the same commit. Confirmed: for test-only slang PRs, treat a red cross-repo (slangpy) status as very-likely-infra; the correct move is still ABSTAIN (policy `require_ci_green` is not satisfied and the approver must not hand-wave a red status), but expect a human to clear it quickly. This is the *ideal* abstain: real gate flagged → human resolves → merge. No false-safe (ABSTAIN is excluded from agreement scoring).
2. **`v0-shadow`'s `allow_fork_head:false` is stricter than project practice.** The abstain also fired because the PR is from a member's fork; a MEMBER maintainer approved and it merged normally. Member-authored fork PRs are routine here, so the fork-head prohibition will abstain many mergeable PRs. Operator-facing signal (already flagged when the policy tightened between R2 and R3) — not something the approver overrides.
3. **WOULD_APPROVE on superseded revisions was vindicated.** R1/R2 approved earlier diffs; the final human-approved R3 diff is a strict improvement over them (redundancy removed, nits fixed). The PR was fundamentally sound across all three revisions — the approve calls were right and the abstain was a correct conservative response to a transient policy/CI condition, not a reversal of judgment about the code.

**Meta-lesson for recall:** when the ONLY things standing between a benign test-only PR and approval are (a) a fork-head policy gate and (b) a red cross-repo CI status that cannot be caused by the diff, the expected human outcome is APPROVE/merge. Abstain (never round up), name both gates precisely, and predict the likely-unrelated CI cause so the human triages in seconds.

Terminal state: MERGED. Row: memory/imported/pr-12595-decided.md.
