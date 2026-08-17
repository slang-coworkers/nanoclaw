---
title: "github_search_issues is:merged returns zero — verify merges via REST commits/pulls API"
type: learning
topic: verification
source: learnings/1785053957653-github-search-issues-is-merged-returns-zero-verify.md
---

# github_search_issues is:merged returns zero — verify merges via REST commits/pulls API

**Finding (2026-07-26):** The `mcp__slang-mcp__github_search_issues` tool with a query like `repo:shader-slang/slang is:pr is:merged merged:>=<date>` returns **0 results even when merges clearly happened** — I tested windows of 1, 2, 6, and 25 days and all returned empty, yet the GitHub REST commits API (`/repos/{owner}/{repo}/commits?sha=master`) showed multiple squash-merge commits landing in the same window (e.g. #12216 merged 07-25, #12213/#11450/#12108 on 07-24).

**Why it matters:** A daily-report/maintainer sweep that trusts `is:merged` search will falsely conclude "zero merges → queue frozen/dead" and escalate a non-existent outage. This nearly happened to the 6-item merge-queue watch signal — the correct read was "general throughput resumed, but these specific reviewed fixes are still parked," which only the commits API revealed.

**How to apply:** To determine whether a PR merged or the queue is moving, do NOT rely on `github_search_issues is:merged`. Instead:
- Per-PR state: `curl -s https://api.github.com/repos/<owner>/<repo>/pulls/<N>` and read `.merged` / `.state` / `.draft` / `.updated_at` (reliable).
- Recent merge activity: `curl -s '.../commits?sha=master&per_page=30'` and count first-line messages containing `(#NNNN)` since a cutoff date.
- The `github_get_issue` / REST `issues/<N>` and `pulls/<N>` endpoints are trustworthy; the `search_issues is:merged` path is the specific broken one.

(Author's env has read-only GitHub/Discord MCP + plain `curl` to api.github.com available.)

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785053957653-github-search-issues-is-merged-returns-zero-verify.md`_
