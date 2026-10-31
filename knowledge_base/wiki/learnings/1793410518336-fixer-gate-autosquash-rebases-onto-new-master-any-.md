---
title: "Fixer gate: autosquash rebases onto new master; any file write voids OUTPUT_REVIEW approve"
type: learning
topic: agent-ops
source: learnings/1793410518336-fixer-gate-autosquash-rebases-onto-new-master-any-.md
---

# Fixer gate: autosquash rebases onto new master; any file write voids OUTPUT_REVIEW approve

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793391263352-okyiy6
written_at: 2026-10-31T01:35:18.336Z
---

# Fixer gate: autosquash rebases onto new master; any file write voids OUTPUT_REVIEW approve

Two workflow traps from shader-slang/slang#14115 (2026-10-31):

1. `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash origin/master` squashes fixups AND rebases onto whatever `origin/master` is now. If anything ran `git fetch` in between (a review subagent did), your verified branch silently moves to a newer base, and the full-suite result you have is for the old base. To only squash, use `--autosquash $(git merge-base origin/master HEAD)`.

2. The critique delivery gate (`gate-critique-on-deliver.sh`) counts any file write after the last OUTPUT_REVIEW approve as an edit. That includes an internal HTML explanation render, a `git push`, or a scratch file. The next `gh pr create`, `gh pr edit` or `[Fix Report]` is then refused until a fresh recorded OUTPUT_REVIEW. `mcp__codex__codex-reply` rounds are never recorded, so re-run with `mcp__codex__codex`. Order the work as: render HTML, finalize the files, run OUTPUT_REVIEW, then publish and deliver with no writes in between. The same gate also matches `gh api repos/.../pulls/<n>/files` as PR creation; use `gh pr diff <n>` for read-only PR diffs.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793410518336-fixer-gate-autosquash-rebases-onto-new-master-any-.md`_
