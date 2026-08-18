---
title: "CodeRabbit under-read measured at ~92% (11/12) — and it only corrupts a row when it coincides with a false absence"
type: learning
topic: ci-tooling
source: learnings/1785779282480-coderabbit-under-read-measured-at-92-11-12-and-it-.md
---

# CodeRabbit under-read measured at ~92% (11/12) — and it only corrupts a row when it coincides with a false absence

## Measurement (retrospective audit, slangpy-pr-approver, 2026-08-03)

Audited **51 approver workspaces / 40 recorded rows / 18 PRs**. Result:

- **11 of 12** CodeRabbit reviews claiming `Actionable comments posted: N>0` carried **zero severity markers in the review body**. The single exception had exactly **1** marker. ⇒ **a body-only tally under-reads ~92% of the time.**
- **Rows actually corrupted: 2 of 40.** Both `ABSTAIN_POLICY / CLAUSE_FAIL:tier_eligible` (review-independent), so **no decision changed and neither was a false-safe** — the wrong input never reached the outcome.

## ⭐ The key insight my earlier learning missed: the two defects MULTIPLY

The under-read alone is nearly harmless in practice. What saved **38 of 40** rows was **the agent reading `pulls/N/comments` by hand** — verified: 100% of inline findings at those revisions are cited by file:line in their docs.

The 2 rows that failed are precisely the 2 where the harvest concluded **no review existed at all**:
- **slangpy#1085 @ `a1da5beac5af`** — harvest timed out (exit 22) still `pending`; doc declared "no CodeRabbit signal" **90s after** the review had posted. 7 findings, **4 🟠 Major**, recorded as `0/0/0` APPROVE / `devin-only`.
- **slangpy#1063 @ `d4e3df4bc408`** — harvest returned **exit 20 ("genuine skip")**: CodeRabbit was never even detected as pending. 4 findings, 1 🟠 Major, recorded `0/0/0`.

⇒ **The under-read only corrupts a row when it coincides with a false absence,** because a *reported* review prompts a manual read and a *reported absence* prompts nothing. **The safety net was the agent, not the tooling** — which is exactly why it needs a forward fix rather than more diligence.

## Forward fix (priority order, revised by the audit)

1. **Treat `Actionable comments posted: N>0` with zero body markers as a hard "findings are elsewhere" flag — never clean.** Catches all 11.
2. **Tally `pulls/N/comments`**, bucketing 🟠 Major / 🟡 Minor / 🔵 Trivial. (Note: `collect-reviews.sh` fetches `issues/$PR/comments` — the *walkthrough summary* — a **different endpoint**; it does not cover this.)
3. **Kill the false-absence half, which is the actual multiplier:** `exit 20` ("genuine skip") is **unsafe** — on #1063 a green-or-absent status silently became "no review." And **`status green ≠ a harvestable review object`**: a run can update its walkthrough comment and produce no review at all.
4. **Re-probe immediately before writing the artifact.** Both bad rows had the review land in the gap between last poll and synthesis (73s and 2m39s). *A timeout describes a past instant, not the present.*
5. **`original_commit_id`, never `commit_id`.** Verified drift: on #1085 all findings now report `777165da48aa` — the *next* revision — while `original_commit_id` correctly reads the decided `a1da5beac5af`.

## Host-side hazard worth a separate fix

**`record_decision` replaces a row per `(repo, pr, commit_sha)` and DROPS any existing `record_human_verdict` stamp.** #1085 carried an `APPROVED` stamp; the correction would have silently destroyed that human-vs-shadow disagreement datapoint. Mitigation used: re-stamp in the same turn **and** embed the human verdict in the correction note so provenance survives a future loss. **Suggest `record_decision` preserve an existing `human_verdict` on replace.**

## Also worth knowing

`gh auth status` reported "token invalid" in that container while reads succeeded — the auditor **verified against a known control** (17 comments on the slang-rhi#803 PR) before trusting any zero. Cf. [gh auth probes are misleading]. And record exit codes to a **separate `.rc` file** so an empty `[]` from a failed call can never be read as "no findings."

Related: [CodeRabbit findings live on pulls/N/comments…] (the original finding), ["present" and "passing" are not "exercising"].

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785779282480-coderabbit-under-read-measured-at-92-11-12-and-it-.md`_
