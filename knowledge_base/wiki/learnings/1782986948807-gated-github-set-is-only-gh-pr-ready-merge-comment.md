---
title: "Gated GitHub set is ONLY gh pr ready + merge — comments/labels/replies/reactions post freely"
type: learning
topic: agent-ops
source: learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md
---

# Gated GitHub set is ONLY gh pr ready + merge — comments/labels/replies/reactions post freely

**Rule (operator, superseding 2026-06-16; re-confirmed slang#11898 2026-07-02):** The operator-gated GitHub actions are **exactly two: `gh pr ready` and `gh pr merge`.** Verified issue/PR **comments, labels, Issue Type, review replies, and reactions POST FREELY** on nv-slang-bot's authority — no operator authorization needed. The precondition is *verification at HEAD*, not a gate: post once the fact is checked at the current commit. (Also: never auto-**close** issues/PRs — surface to a human maintainer; that's a separate no-auto-close rule, not part of the "gated" set.)

**Why:** On slang#11898, slang-fixer three times said "issue comment may be wanted but comments are operator-gated — flagging, not posting" for a routine status footprint on a draft-held PR. That's wrong and it *blocks the draft-held observability requirement* (a draft PR's `Closes #N` doesn't auto-surface on the issue, so a current human-visible footprint on the issue is REQUIRED — and posting/editing it is not gated). Root cause: the **stale wording lives in the composed group Additional Instructions / spine trait** (recomposed every container wake), and the older shared learning [[1781523727513-gated-github-write-needs-a-traceable-operator-sour]] still lists "comment / label / emoji reaction" inside the gated set. Both propagate the error; it recurs every fresh session until the spine source is corrected.

**How to apply:**
- Draft-held PR → the owning tier MUST post/edit the 5-bullet footprint on the issue (verdict = "triaged → fix in draft PR #N, held pending review"). This is not gated.
- Edit-in-place hygiene: if nv-slang-bot was the last commenter, EDIT that comment rather than stacking a new one; only add a new comment after another user has replied since.
- The ONLY things to hold for the operator: `gh pr ready`, `gh pr merge`. A human maintainer (e.g. the PR assignee) owns those on GitHub; a bot-initiated ready/merge is what's gated — a maintainer flipping/merging is fine.
- If your composed instructions still say comments are gated, they're stale — trust this rule; the spine wording is a known pending fix (Main owns it, needs the nanoclaw repo).

Related: [[1781523727513-gated-github-write-needs-a-traceable-operator-sour]] (its traceability point stands; its gated-set enumeration is the stale part), and Main's `feedback_github_writes_operator_authorized`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782986948807-gated-github-set-is-only-gh-pr-ready-merge-comment.md`_
