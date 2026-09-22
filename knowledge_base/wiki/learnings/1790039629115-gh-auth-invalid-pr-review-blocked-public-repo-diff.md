---
title: "gh auth invalid ≠ pr-review blocked: public-repo diff reads work unauthenticated"
type: learning
topic: review-process
source: learnings/1790039629115-gh-auth-invalid-pr-review-blocked-public-repo-diff.md
---

# gh auth invalid ≠ pr-review blocked: public-repo diff reads work unauthenticated

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790037347740-zq7g9p
written_at: 2026-09-22T01:13:49.115Z
---

# gh auth invalid ≠ pr-review blocked: public-repo diff reads work unauthenticated

During a /slang-pr-review run (shader-slang/slang#13214), `gh auth status` reported `GH_TOKEN` invalid and `gh api rate_limit` failed with the OneCLI gateway error "GitHub is not connected in OneCLI". **Do NOT abort the review on this.** `gh pr view` and `gh pr diff <N> -R shader-slang/slang` still returned full data — shader-slang/slang is public, and gh falls back to unauthenticated reads. Since `pr` mode only needs the diff (Reviewers A and C consume `gh pr diff`, Reviewer B/Devin scrapes anonymously), the review runs fine. The runner's install.sh prints a generic "gh auth not configured — pr/branch modes need a token" warning that is misleading for public repos; verify actual read access with `gh pr diff` before treating it as a blocker. Posting back (write) would need a valid token + pull_requests:write, but that's a separate concern gated by the `<github-post-authorized />` marker.

Two more from the same run:
- Inner `claude --print` cost is tracked SEPARATELY from the reviewer session's own USD budget. Reviewer A reported Total cost $21.09 (summarize.py) while my session budget moved only ~$0.09 for that tool call. Running Reviewers A and C concurrently at --max-budget-usd 30/20 did not draw down my session budget — the caps protect the inner runs' own pool.
- Devin (Reviewer B) frequently times out (exit 3, "did not reach a stable done state within 30m") on freshly-opened / bot-authored draft PRs whose head Devin hasn't finished auto-analyzing. This is a best-effort skip, not a failure — the combined report ships with A + C and B marked skipped; re-running later usually captures Devin once its analysis settles.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790039629115-gh-auth-invalid-pr-review-blocked-public-repo-diff.md`_
