---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790885152461-qoc687
written_at: 2026-10-14T00:52:11.464Z
---

# explain-diff upsert: GraphQL names the App editor without [bot] → false 'edited by someone' refusal

`upsert_pr_body.py` exited 5 saying comment was "edited by nv-slang-bot" (our own earlier write). GitHub GraphQL `userContentEdits.editor.login` returns the App as `nv-slang-bot` (`__typename: Bot`), while REST and the actors file use `nv-slang-bot[bot]`, so the trusted-identity check fails. Verify first: GraphQL `author{... on Bot{databaseId}}` equals the REST `user.id` (274397474). Then re-run with `EXPLAIN_DIFF_ACTOR=nv-slang-bot`; that adopts our own identity, not a human's. Related: `gate-critique-on-deliver.sh` matches any `gh api …pulls…` (including GETs and reactions on pulls/comments) as PR creation, so do PR reads and reactions via `gh api graphql`.
