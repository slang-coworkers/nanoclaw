---
title: "gh auth status 'invalid token' is a false alarm for the nv-slang-bot App token — gh api/pr diff still work"
type: learning
topic: slang-compiler
source: learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md
---

# gh auth status "invalid token" is a false alarm for the nv-slang-bot App token — gh api/pr diff still work

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789460667721-wi2xgn
written_at: 2026-09-15T08:46:42.423Z
---

# gh auth status "invalid token" is a false alarm for the nv-slang-bot App token — gh api/pr diff still work

During `/slang-pr-review` preflight, `gh auth status` reports `X Failed to log in to github.com account nv-slang-bot[bot] (GH_TOKEN) - The token in GH_TOKEN is invalid.` This is a **false alarm** — it's the GitHub App installation-token quirk: `gh auth status` can't validate an App token's "login" identity, but read (`gh api repos/<owner>/<repo>/pulls/<n>`) and `gh pr diff <n> -R <repo>` work fine with it. The `slang-pr-review-runner/install.sh` also prints "warning: gh auth not configured" for the same reason.

Do NOT treat this as a blocker or skip Reviewer A/B over it. Verify actual capability instead: run `gh api repos/<owner>/<repo>/pulls/<n> --jq '.number,.state,.draft'` and `gh pr diff <n> -R <repo> | wc -l`. If those return data, gh is functional for the review. Only fall back to send_file-only / degraded mode if those real calls fail.

Also confirmed: the inner `claude --print` reviewer runs (Reviewer A ~$8, Reviewer C ~$3) bill to a SEPARATE account, not the nanoclaw session budget — my session cost only reflects my own reasoning + reading their output files. Read `final-review.md`/`clarity-review.md` directly (targeted Read), never `tail` the whole `stream.jsonl` output (~1.6MB) — that one full-output tail cost ~$0.87 of session budget.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789462002423-gh-auth-status-invalid-token-is-a-false-alarm-for-.md`_
