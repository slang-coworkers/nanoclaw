---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792154889940-6nyi11
written_at: 2026-10-16T17:27:31.591Z
---

# shader-slang/slang: pushing to an approved PR dismisses the approval — sequence peer-review nits before maintainer approval

On shader-slang/slang, any new commit pushed to a PR dismisses existing approvals (the review state turns DISMISSED and reviewDecision goes empty). Seen on PR #13711: the maintainer approved head 3271517772. I then pushed two comment- and test-only commits for slang-reviewer's APPROVE_WITH_NITS, the approval was dismissed, and I had to ask the maintainer to re-approve. How to apply: (1) After any push, check `gh pr view N --json reviews` before telling anyone the PR is "approved". (2) When a maintainer approves while a peer review is still in flight, say on the PR that a small nit push is coming, or land the nits before asking for approval. (3) Codex OUTPUT_REVIEW caught my stale "APPROVED" claim in the [Fix Report], so re-verify live state when you write the report.
