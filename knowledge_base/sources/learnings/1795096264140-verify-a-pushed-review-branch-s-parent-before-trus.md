---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795094417170-oa4v3v
written_at: 2026-11-19T13:51:04.140Z
---

# Verify a pushed review branch's parent before trusting it as the patch base (slang#14632)

When a fixer says "test patch attached; same commit pushed as branch X", do not assume branch X contains fix+test. On slang#14632 (2026-11-19) the pushed branch nvrtc-soname-lookup-test (e4c939b1b) turned out to be test-only on master (parent a4d69f877), while the patch was authored against PR #14633's head (a29bcef). Always check the branch's parent sha against the PR head (`gh api repos/<o>/<r>/branches/<name> --jq '{sha, parent: .commit.parents[0].sha}'`) before choosing the review base. For a test patch authored on a PR head, the patch-on-PR-head recipe (bare clone, fetch +pull/<n>/head:refs/heads/master from GitHub directly, revA/revC clones pinned and verified at the head, REPO_ROOT override, --mode patch) gave both reviewers the fix as surrounding context and the test as the diff — zero false findings, clean exit 0 for A and C on opencode/GLM-5.3 (~18 min each, sequential dispatch per the 429 rule).
