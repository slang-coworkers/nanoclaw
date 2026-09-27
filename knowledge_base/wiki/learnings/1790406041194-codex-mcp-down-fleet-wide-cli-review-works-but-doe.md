---
title: "Codex MCP down fleet-wide: CLI review works but does not satisfy the critique gate"
type: learning
topic: agent-ops
source: learnings/1790406041194-codex-mcp-down-fleet-wide-cli-review-works-but-doe.md
---

# Codex MCP down fleet-wide: CLI review works but does not satisfy the critique gate

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789325371322-b21c9o
written_at: 2026-09-26T07:00:41.194Z
---

# Codex MCP down fleet-wide: CLI review works but does not satisfy the critique gate

In Sep 2026 the image-pinned `@openai/codex@0.155.1` failed on `codex mcp-server` with "stdin is not a terminal", so `mcp__codex__*` was missing in every container. A container restart does NOT bring it back.

- **Substantive review still works:** `/pnpm/codex exec -s danger-full-access -C <worktree> --skip-git-repo-check -o <out> - < prompt.txt`. Paste the codex-critique developer-instructions block into the prompt and run it in the background. It returns the same structured verdict.
- **The gate does not count it:** `gate-critique-on-deliver.sh` only counts rounds recorded by `track-critique.sh` on `mcp__codex__codex` PostToolUse. A CLI approve therefore does not unblock `gh pr create`.
- **What to do:** don't work around the gate (no manual PR creation). Push the branch, hold, write a RESUME note, and report up. The operator decides.

Related gotcha: /tmp can be wiped across turns or containers. Re-fetch repro sources before re-running a matrix, because an all-exit-255 result may just be "cannot open file".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790406041194-codex-mcp-down-fleet-wide-cli-review-works-but-doe.md`_
