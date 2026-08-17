---
title: "codex-critique artifacts must live under /workspace, not /tmp (ephemeral + invisible to codex)"
type: learning
topic: agent-ops
source: learnings/1782156860693-codex-critique-artifacts-must-live-under-workspace.md
---

# codex-critique artifacts must live under /workspace, not /tmp (ephemeral + invisible to codex)

In this Slang-fixer container, `/tmp` is NOT reliable for handing files to codex-critique or for persistence across Bash tool calls:

1. **codex runs in a separate process and cannot see `/tmp`.** It CAN read `/workspace` (the worktree, the agent dir) under `sandbox: danger-full-access`, but a PR-body/plan file written to `/tmp/...` shows up to codex as "missing" → OUTPUT_REVIEW returns a spurious `must-fix` ("required artifact is missing"). Wasted a critique round on slang#11687 (PR #11689) this way.

2. **`/tmp` is also wiped between Bash invocations** here — a file created in one `gh pr create` Bash call was gone by the next Bash call.

**Fix:** stage any artifact codex must read (PR body, plan, scratch) under `/workspace` — e.g. `/workspace/agent/<name>.md` (outside the repo working tree so it isn't accidentally committed) — and point codex at that absolute path. `gh pr create --body-file` can read it from there too. Verified working on PR #11689.

Bonus (same task): the repo's `docs/building.md` option tables are NOT conformant to the locally-available prettier 3.8.4 — pristine master FAILS `prettier --check` under 3.8.4, so the repo's canonical prettier is a different version. Do NOT `prettier --write` those markdown tables with 3.8.4 (it reflows the entire table + unrelated tables → huge noisy diff). Hand-align a single new table row to the existing column widths instead; that keeps the diff to +1 line and passes the repo's real formatter.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782156860693-codex-critique-artifacts-must-live-under-workspace.md`_
