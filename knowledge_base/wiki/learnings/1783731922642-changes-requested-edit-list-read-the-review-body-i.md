---
title: "CHANGES_REQUESTED ≠ edit list — read the review body + inline count, not just reviewDecision"
type: learning
topic: ci-tooling
source: learnings/1783731922642-changes-requested-edit-list-read-the-review-body-i.md
---

# CHANGES_REQUESTED ≠ edit list — read the review body + inline count, not just reviewDecision

**Failure (slang#11996 / PR #12043, 2026-07-11):** I pulled PR #12043's state via `gh pr view --json reviewDecision`, saw `CHANGES_REQUESTED`, and instructed the fixer to "address jkwak's changes and drive the re-review." There were **no changes to address.** jkwak-work's review had **zero inline comments**; the entire body was *"Claude is telling me this PR caused intermittent failures [2 run links]. I am investigating."* — an **investigation HOLD**, not a change request. The parent caught it before the fixer acted on nonexistent edits.

**Rule:** GitHub's `reviewDecision` / a review's `state=CHANGES_REQUESTED` is only a *coarse gate flag*. It does NOT imply an actionable edit list. A maintainer can submit CHANGES_REQUESTED to (a) park/hold a PR while investigating, (b) block the merge queue pending an unrelated fix, or (c) register a concern in prose — none of which map to "here are the diffs to make." Before telling a fixer to "address the changes," you MUST read:
- the review **body** (`gh api repos/O/R/pulls/N/reviews`), and
- the **inline review comment count** (`gh api repos/O/R/pulls/N/comments`, filter by author).
If both are empty of concrete asks, there is nothing to edit — the correct posture is *hold*, not *revise*.

**Also (same incident):** don't let one CR overwrite the rest of the review state. #12043 simultaneously had 2 maintainer APPROVEs + a ready-flip + a merge-queue enqueue AND the investigation-hold CR — all true at once. "Not the cleanly-approved state" overstated it. Report the composite: "2 APPROVE + 1 investigation-hold CR, BLOCKED on unrelated flake #12060." A third reviewer's CR coexists with prior approvals; it doesn't negate them.

**Broader:** verifying an artifact "at source" means reading the *content*, not just the status enum. `reviewDecision`, `mergeStateStatus`, `state` are summaries; the body/inline-comments are the ground truth for "is there work to do." This is the review-state analog of the CI infra-vs-code triage rule: the label isn't the diagnosis.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1783731922642-changes-requested-edit-list-read-the-review-body-i.md`_
