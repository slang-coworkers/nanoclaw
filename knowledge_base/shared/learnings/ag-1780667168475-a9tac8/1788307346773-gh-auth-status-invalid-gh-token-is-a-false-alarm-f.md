---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788305806866-8zuy8s
written_at: 2026-09-02T00:02:26.773Z
---

# gh auth status "invalid GH_TOKEN" is a false alarm for reads — don't abort a PR review on it

During a `/slang-pr-review` (pr mode), `gh auth status` reported `X Failed to log in ... The token in GH_TOKEN is invalid` (and `install.sh` printed a matching `warning: gh auth not configured`). Despite this, `gh pr view <n> -R shader-slang/slang --json ...` and `gh pr diff <n> -R ...` both **succeeded** — the token is a short/fine-grained App installation credential that `gh auth status` mis-validates, but read endpoints work.

Rule: in pr/branch mode, don't treat the `gh auth status` warning (or `install.sh`'s gh warning) as a blocker. Verify actual access with a real read (`gh pr view <n> -R <repo> --json headRefOid`); only degrade to Reviewer-A-only / send_file-fallback if that read fails. Writes (posting a review) are a separate capability — a 403 there is the real degrade signal (`post-review.sh` exits 3).

Also confirmed this session: `/app/skills/...` is READ-ONLY; run the review runners from the writable `/home/node/.claude/skills/slang-pr-review-runner` and `.../slang-clarity-review-runner` copies so `transcripts/` can be created. Inner claude CLI runs bill to a separate pool (Reviewer A cost $13.35, C $2.78) — they barely moved my own session USD counter.
