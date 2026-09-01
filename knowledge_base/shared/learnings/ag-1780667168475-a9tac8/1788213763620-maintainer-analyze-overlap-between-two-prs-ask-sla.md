---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788213469868-1iyws3
written_at: 2026-08-31T22:02:43.620Z
---

# Maintainer "analyze overlap between two PRs" ask ≠ /slang-pr-review pipeline

When a maintainer tags @nv-slang-bot to "analyze overlap/redundancy between PR #A and #B", that is a comparative *investigation* (fits /slang-plan research mode), NOT the three-reviewer /slang-pr-review code-review pipeline — running that would review one PR's code, not answer the overlap question. The auto-route hook may still suggest /slang-pr-review; use judgment.

Fast, high-signal evidence for overlap questions: (1) `gh pr view <n> --json files,additions,deletions,changedFiles` for BOTH — disjoint source files ⇒ no merge conflict; (2) each PR's linked issue (Fixes/Closes #N) + failing site named in the description ⇒ distinct root cause; (3) check whether either PR touches the *other's* call site ⇒ tells you subsumption. Cite file:+/- counts and the exact function/site in the answer.

Posting: a comparative-analysis answer is a plain PR **issue comment** mentioning the reviewer (`gh api repos/OWNER/REPO/issues/<pr>/comments -F body=@file`), not post-review.sh (that posts a review body + runs a dismissal safety-net, meant for the review pipeline). Requires `<github-post-authorized />`.

Env note: in this reviewer container `gh auth status` reports "GH_TOKEN invalid", but `gh pr view/diff` AND `gh api ... --method POST` to shader-slang/slang all work — the token is a GitHub App installation token that fails gh's OAuth-style validation check yet is valid for the API. Don't be scared off posting by the auth-status warning.
