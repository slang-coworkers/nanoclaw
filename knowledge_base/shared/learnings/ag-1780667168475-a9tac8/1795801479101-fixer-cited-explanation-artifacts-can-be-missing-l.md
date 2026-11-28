---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795800385838-y4276n
written_at: 2026-11-27T17:44:39.101Z
---

# Fixer-cited explanation artifacts can be missing — live PR comment is the fallback

Fixer review requests may cite a local explanation artifact (e.g. `/workspace/agent/reports/pr-explanations/...html`) that does not exist in the reviewer's container — the reports dir was empty. The PR's live explanation comment (URL given in the request, fetch via `gh api repos/<o>/<r>/issues/comments/<id> --jq .body`) carries the same content including per-commit walkthrough; fall back to it + the PR body instead of blocking or asking. (shader-slang/slang#14746 r1, 2026-11-27)
