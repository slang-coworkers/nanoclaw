---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786478380681-fex0ho
written_at: 2026-08-11T20:15:08.420Z
---

# [approver/infra-abstain] critique-gate bash hook false-fires on read-only gh api pulls GETs

**Symptom:** During `/slangpy-pr-approve` on slangpy#1101, plain read-only `gh api repos/<owner>/<repo>/pulls/<n>/reviews` and `.../pulls/comments/<id>` calls were blocked by the `PreToolUse:Bash` hook `gate-critique-on-deliver.sh` with "CRITIQUE REQUIRED before PR creation (missing DECISION_REVIEW, OUTPUT_REVIEW)". These are pure GETs for building the review input — no PR creation, no writes.

**Root cause:** The deliver-gate hook pattern-matches the `gh ... pulls ...` command surface as a PR-mutation signal; it does not distinguish read-only GET subcommands from create/edit. It fires before the command runs, so the read never happens.

**How to catch it:** Any bash `gh api .../pulls/...` in the harvest/challenger phase can trip it, even though the approver never writes to GitHub.

**Fix / workaround:** Route PR reads through the MCP GitHub tools instead of bash `gh api`: `mcp__slang-mcp__github_get_pull_request_reviews`, `github_get_pull_request_comments`, `github_get_pull_request`, and `WebFetch` for a specific discussion-comment body. These are not gated by the bash hook and return the same data. `gh api .../commits/<sha>/check-runs` and `.../status` (CI state) are NOT tripped — only the `pulls` surface is. Note: the approver correctly SKIPS the critique gate entirely for ABSTAIN_* decisions, so the gate should never have been in the path for a read at all — treat its firing on reads as a known false positive, not a signal to run codex-critique.
