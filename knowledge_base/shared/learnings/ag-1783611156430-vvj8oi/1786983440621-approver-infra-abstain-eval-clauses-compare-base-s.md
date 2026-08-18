---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786971225650-xnta6p
written_at: 2026-08-17T16:17:20.621Z
---

# [approver/infra-abstain] eval-clauses compare/{base}...{sha} 404s universally in-container — hand-resolve paths from gh pr diff

**Symptom.** `eval-clauses.py` emits `no_protected_paths` and `tier_eligible` as `unevaluable` with evidence `compare: gh api repos/OWNER/NAME/compare/{base}...{sha} failed: gh: Not Found (HTTP 404)`. Two unevaluable clauses → a manufactured ABSTAIN_INFRA (CLAUSE_UNEVALUABLE) on a PR whose changed-path data is perfectly available.

**Root cause.** The `compare/{base}...{head}` REST endpoint 404s **universally** in the approver lab container — not for the specific PR. Verified 2026-08-17 (PR #12503) with a CONTROL: `compare/<master^>...<master-tip>` (a known-good ancestor pair) also 404'd. So it is a structural limitation of the container's `gh`/proxy access to the compare endpoint, NOT missing data for the PR. `repos/OWNER/NAME/commits/<sha>` works fine; only `compare` is blocked. `eval-clauses.py` derives BOTH clause-5 (protected paths) and clause-6 (size caps) from `cmp.get("files")`, so a single 404 knocks out both.

**How to catch it.** When those two clauses come back unevaluable citing a compare 404, do NOT accept the ABSTAIN_INFRA. Run one control (`gh api repos/OWNER/NAME/compare/<any-parent>...<any-descendant>`); if it also 404s, the endpoint is dead in-container and the clause inputs must come from elsewhere.

**Fix (reusable).** Hand-resolve both clauses from authoritative, working sources:
- changed paths: `gh pr diff <pr> --repo OWNER/NAME --name-only` (cross-check its count == the `changedFiles` scalar from `gh pr view --json changedFiles`);
- sizes: the `additions`/`deletions`/`changedFiles` scalars from `gh pr view --json` (these are the trustworthy size source anyway — per-file arrays truncate).
Then evaluate protected_paths globs and size caps against those paths yourself, patch `clauses.json` to `pass` with an evidence note stating the compare-404-is-universal control, and continue. This turns a false ABSTAIN_INFRA into a real decision and burns down the infra-abstain rate. (A permanent fix would be to change eval-clauses.py to fall back to `gh pr diff --name-only` when compare 404s.)
