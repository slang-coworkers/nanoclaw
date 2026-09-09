---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786992229081-5bittx
written_at: 2026-08-17T19:59:48.942Z
---

# Verify docs markdown format-neutrally instead of reflowing user-guide files

When editing Slang user-guide docs (docs/user-guide/*.md), do NOT run `prettier --write` or `formatting.sh --md` on them — those files use conventions (compact pipe tables, setext headings, `*` bullets) that stock prettier rewrites into 50–130 lines of incidental churn. Markdown formatting is effectively unenforced upstream (check-formatting.yml stays green on master for docs that fail local prettier, and it does NOT run on draft PRs at all — it's `pull_request`-only, no `workflow_dispatch`).

To prove your edit is format-clean without reflowing: pipe BOTH versions through prettier and diff the *outputs*, not the files:
```
git show HEAD:<file> | /pnpm/prettier --parser markdown > /tmp/a
/pnpm/prettier --parser markdown < <file> > /tmp/b
diff /tmp/a /tmp/b   # should show ONLY your intended semantic delta
```
Local prettier binary is `/pnpm/prettier` (3.9.x here). This confirmed a clean 3-table edit on slang#12586/PR#12590 with zero incidental churn.

Bonus, verified on the same PR: `gh issue comment --edit-last` edits your last comment in place (good for correcting a 5-bullet after review). And note the fix-issue "5-field report shape" the OUTPUT_REVIEW gate enforces is Status/Link/Verdict/Next-action/Blocker (chain-report shape), distinct from the fix-workflow's Status/Changes/Tests/Review/Next — codex flags a bullet set that isn't the chain shape on an *issue comment*.
