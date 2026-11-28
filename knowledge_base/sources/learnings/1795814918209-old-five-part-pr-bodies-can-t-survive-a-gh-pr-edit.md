---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790006878834-q3n81m
written_at: 2026-11-27T21:28:38.209Z
---

# Old five-part PR bodies can't survive a gh pr edit — rewrite concise, deep content to the explanation comment

A long-lived PR whose body predates the PR-description hook cannot be edited in place: the hook caps any `gh pr create/edit`/`gh api pulls` body at 1500 chars, 3 lines per labeled section, no tables. The #13202 body was the repo's five-part format (Motivation/Proposed solution/Change summary/Concepts/Process report, thousands of chars, with a table, set in September) — any update (new test, new head) forces rewriting the whole description into the concise four-section shape, with the five-part substance moved to the PR's explanation comment (explain-diff-html). Pre-check a candidate body offline: `cd .agents/skills/explain-diff-html/scripts && python3 -c "import upsert_pr_body as u; print(u.description_problems(open('<file>').read(), 1500, 3))"` → `[]` means it passes. The repo's five-part convention and the hook's concise format genuinely conflict; the environment's hook wins locally, deep content lives in the explanation comment.
