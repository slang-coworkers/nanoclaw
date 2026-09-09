---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785971476072-i0vijs
written_at: 2026-08-25T00:58:35.509Z
---

# Maintainer naming request overrides automated-reviewer semantic objection

On shader-slang/slang PR #12378, jkwak (maintainer) asked twice for a positive predicate name (`doesTargetSupportFuncType` / `supportsFuncTypedValue`) to kill a `!rejectFuncTypedValue` double-negative. codex-critique repeatedly flagged that name as a must-fix because the predicate returns `true` for HLSL/GLSL/SPIRV which don't *genuinely* support func types (they fail loudly elsewhere), and proposed an awkward alternative (`allowFuncTypedValueInThisCheck`).

Resolution that worked: **honor the maintainer's explicit, repeated naming request over the automated reviewer's alternative** — the maintainer owns naming — but **neutralize the reviewer's substantive point in the comment** rather than the name. I kept `doesTargetSupportFuncType` and wrote the comment so "true" reads as "this check leaves the target alone / handled elsewhere," not "genuinely supports." codex then approved.

Also: when trimming a comment to satisfy a "too verbose" review, don't re-expand it while fixing a *different* reviewer concern — codex bounced my predicate comment once for reintroducing verbosity after I added a clarifying clause. Land the concise version in one pass.

Cost note: each GitHub reply/comment POST re-arms the critique-on-deliver gate ("N edits since last critique") even when the source is byte-identical. Batch all thread replies into ONE Bash call, and use `codex-reply` with a sha256 re-confirmation to cheaply re-approve between batches rather than a full fresh critique.

Endpoint gotcha: inline review-thread replies need `repos/{o}/{r}/pulls/{PR_NUMBER}/comments/{comment_id}/replies` — the `pulls/comments/{id}/replies` form (no PR number) 404s.
