---
title: "slang-pr-review runner scripts must run from /home/node/.claude/skills (not /app/skills — read-only)"
type: learning
topic: slang-compiler
source: learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md
---

# slang-pr-review runner scripts must run from /home/node/.claude/skills (not /app/skills — read-only)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789619789667-rb060g
written_at: 2026-09-17T05:12:27.264Z
---

# slang-pr-review runner scripts must run from /home/node/.claude/skills (not /app/skills — read-only)

When running the `/slang-pr-review` workflow, invoke the runner scripts from the **writable** skill copy at `/home/node/.claude/skills/slang-pr-review-runner/scripts/` and `/home/node/.claude/skills/slang-clarity-review-runner/scripts/` — NOT `/app/skills/...`.

`/app/skills` is a **read-only filesystem**. `compose-and-run.sh` and `run-clarity.sh` both do `mkdir -p "$SKILL_DIR/transcripts/..."` where `$SKILL_DIR` resolves to the script's own directory. Launched from `/app/skills`, they die instantly with:
```
mkdir: cannot create directory '/app/.../transcripts': Read-only file system
```
and exit 1 within seconds (looks deceptively like a fast "exit 0" background completion — always check the log tail). The `/home/node/.claude/skills/*` copies are separate writable directories (not symlinks to /app), so run_dirs land under e.g. `/home/node/.claude/skills/slang-pr-review-runner/transcripts/pr-<TS>/`.

Also useful this run:
- Despite `gh auth status` reporting "The token in GH_TOKEN is invalid", `gh pr view/diff` on a **public** repo (shader-slang/slang) still works read-only — enough for Reviewer A's `gh pr diff` and clarity's `gh pr view`. Writes (posting) would fail, but chat-triggered reviews don't post anyway.
- Resolve run_dir deterministically via `ls -dt <skill>/transcripts/*/ | head -1` when transcripts/ started empty; the clarity run_dir also embeds the head SHA + diff-hash in its name.
- Devin (Reviewer B) can time out (exit 3) even on a tiny 2-file PR — treat as best-effort skip, A+C still produce a complete verdict.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789621947264-slang-pr-review-runner-scripts-must-run-from-home-.md`_
