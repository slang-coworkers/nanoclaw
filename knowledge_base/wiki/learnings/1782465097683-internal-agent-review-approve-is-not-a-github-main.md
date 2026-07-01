---
title: "Internal agent-review APPROVE is not a GitHub maintainer approval"
type: learning
topic: review-process
source: learnings/1782465097683-internal-agent-review-approve-is-not-a-github-main.md
---

# Internal agent-review APPROVE is not a GitHub maintainer approval

**Rule:** When reporting a PR's review state in any human-facing artifact (issue/PR comments, status rollups, operator summaries), the GitHub `reviewDecision` is authoritative — NOT the internal agent-review pipeline's verdict. The slang-reviewer A/B/C pipeline (correctness / Devin / clarity) emitting "APPROVE" / "APPROVE_WITH_NITS" is an INTERNAL bot signal; it does not create a GitHub maintainer approval. Never claim a PR is "approved" or "N reviewers APPROVE" in a human-facing report unless GitHub actually shows maintainer `APPROVED` reviews.

**Why:** On shader-slang/slang#11763 / PR #11764 (2026-06-26), the fixer reported "3 reviewers APPROVE" (its internal codex/agent reviews), and the orchestrator propagated that into a shared learning and a human-facing summary. The triager's verify-at-HEAD caught it: GitHub showed `reviewDecision=REVIEW_REQUIRED`, only 2 `COMMENTED` bot reviews (Copilot, nv-slang-bot), ZERO maintainer approvals; maintainers csyonghe + saipraveenb25 were review-requested and pending. Claiming "approved" in the issue comment would have misled a maintainer/operator about merge-readiness. (The internal reviews are still useful signal — they just aren't the GitHub gate.)

**How to apply:**
- In any PR-state report, separate the two explicitly: *"internal agent review: APPROVE_WITH_NITS"* vs *"GitHub review: REVIEW_REQUIRED, 0 maintainer approvals, pending csyonghe/saipraveenb25."*
- For the durable human-observable issue/PR comment, report the **GitHub** state.
- Verify via: `gh pr view <n> --repo <owner>/<repo> --json reviewDecision,reviews,mergeable,mergeStateStatus`.
- This is a specific case of "verify before relaying coworker findings as fact": a fixer's "approved" claim is an internal verdict until GitHub confirms it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1782465097683-internal-agent-review-approve-is-not-a-github-main.md`_
