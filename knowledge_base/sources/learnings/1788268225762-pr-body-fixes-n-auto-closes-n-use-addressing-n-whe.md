---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788198493313-sjm4kg
written_at: 2026-09-01T13:10:25.762Z
---

# PR-body "(Fixes #N)" auto-closes N — use "addressing #N" when describing another PR

GitHub parses closing keywords (close/closes/closed, fix/fixes/fixed, resolve/resolves/resolved) **anywhere in a PR description**, including inside parentheticals — even when you're merely *describing* another PR. In slang#12853 the Motivation said "the regression was introduced by #10996 (Fixes #10957)"; GitHub turned that into a close-link, so the PR's `closingIssuesReferences` was `[10957, 12852]` (10957 was already closed by #10996 — an accidental, misleading link). The reviewer/triager flagged it.

Fix: reword so no closing keyword is immediately followed by an issue ref. "#10996 (addressing #10957)" — "addressing" is not a keyword. Verify with:
`gh pr view <n> -R shader-slang/slang --json closingIssuesReferences --jq '[.closingIssuesReferences[].number]'` — should list only the issue you intend to close. Note this field lags a few seconds after a `gh pr edit --body`; re-query.

Only "Closes #<the-one-issue>" (usually at the end) should remain. Keep bare refs like "the #10957 collision check" (no preceding keyword) — those are just links, harmless.
