---
title: "[approver/clause-gap] author_trust reads the PR AUTHOR's association only — a MEMBER approval pinned to head cannot satisfy it, so bot-authored PRs abstain identically reviewed or not"
type: learning
topic: review-approval
source: learnings/1785935735721-approver-clause-gap-author-trust-reads-the-pr-auth.md
---

# [approver/clause-gap] author_trust reads the PR AUTHOR's association only — a MEMBER approval pinned to head cannot satisfy it, so bot-authored PRs abstain identically reviewed or not

**Symptom.** On shader-slang/slangpy#1078 a `synchronize` arrived with what looked like the decisive change: `ccummingsNV` (`author_association=MEMBER`) had submitted an `APPROVED` review **pinned to the exact head sha**, and `reviewDecision` flipped `REVIEW_REQUIRED` → `APPROVED`. The expectation — stated in the tasking — was that `author_trust` would now PASS, unmasking a separate CI-clause bug that a dominating FAIL had been hiding.

It did not. `author_trust` FAILED again, same reason code, and the CI bug stayed masked.

**Root cause.** The clause reads the **PR author's** association, never a reviewer's:

    eval-clauses.py:133   meta = gh_json(f"repos/{repo}/pulls/{pr}")
    eval-clauses.py:143   assoc = (meta.get("author_association") or "").upper()

`author_association` on the *pull* object describes the PR **author**. Measured: `nv-slang-bot[bot]` = `CONTRIBUTOR`, unchanged by any review. `ccummingsNV`'s `MEMBER` lives on the *review* object, which no clause consumes.

**Why it matters.** `ABSTAIN_POLICY` means "a human must look." Here a human **did** look — a MEMBER approved the exact head. The decision is still correct under v0-shadow (the policy is deliberately conservative and never auto-approves), but the **reason code no longer describes the situation**: `CLAUSE_FAIL:author_trust` reads as "untrusted author, nobody vouched", when in fact a maintainer vouched explicitly. Consequences:

- Every bot-authored PR abstains **identically** whether or not a maintainer reviewed it, so the ledger cannot distinguish "no human engagement" from "fully approved by a MEMBER". That flattens exactly the signal agreement-scoring needs.
- Because bot-authored PRs also hit harvest exit 20 (production review skips them), they are the population most dependent on the Devin-only tier — so they are simultaneously the least-covered and the least-differentiated rows.
- A dominating FAIL **masks defects in every other clause**. On this PR the `ci_green_on_sha` false-safe (legacy combined-status reporting `success` off `license/cla` alone while 12 of 14 check-runs were non-completed) never influenced the outcome — twice, on two revisions. A clause that always fails on a whole PR class is a permanent blindfold over the rest of the conjunction for that class. Don't assume an unmasking event will arrive to test them; verify masked clauses directly.

**How to catch it.** When a clause's expected value flips on new GitHub state, **read the clause's source before concluding** — the field name (`author_association`) is ambiguous between author and reviewer, and both exist in the payloads. `gh api repos/{repo}/issues/{n} --jq '.author_association'` is the PR-author value; reviewer associations come from `/pulls/{n}/reviews[].author_association`. Never infer a clause's input from a field name that appears in more than one object.

**Fix — for the operator, not the agent.** `APPROVAL_POLICY.json` says "Widen only with human sign-off", so this is a proposal, not a change: consider a distinct clause (e.g. `human_review_present`) that records a MEMBER/OWNER/COLLABORATOR `APPROVED` review pinned to the decision sha, and a reason code that distinguishes "untrusted author, no human engagement" from "untrusted author, human approved". **Explicitly NOT recommended:** making a reviewer's approval satisfy `author_trust` — that would let review state substitute for authorship trust and is precisely the widening that needs sign-off. The clause is doing what it says; what's wrong is that the reason code overstates what it found.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785935735721-approver-clause-gap-author-trust-reads-the-pr-auth.md`_
