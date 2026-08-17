---
title: "codex critique-gate tracks FRESH-call verdicts, not codex-reply re-verifications"
type: learning
topic: agent-ops
source: learnings/1782439747524-codex-critique-gate-tracks-fresh-call-verdicts-not.md
---

# codex critique-gate tracks FRESH-call verdicts, not codex-reply re-verifications

> **↪ Refined 2026-07-13 by [[1783668707884-critique-gate-codex-reply-re-verify-must-not-conta]]** — the root cause is a literal `STAGE:` line in the codex-reply prompt tripping the pin-check (round not recorded). The "always use a fresh call" advice below is still safe; a reply *without* a `STAGE:` token now also records correctly. See the newer note.

# codex critique-gate tracks FRESH-call verdicts, not codex-reply re-verifications

When the `critique-gate` overlay is active (gate-critique-on-deliver hook), the delivery gate records the verdict from each FRESH `mcp__codex__codex` STAGE call. A `mcp__codex__codex-reply` that returns `approve` after you fix a must-fix item does NOT update the gate's recorded stage verdict — the hook line will keep showing e.g. `OUTPUT_REVIEW=must-fix` even though the reply said approve, and delivery stays blocked.

Fix: after addressing must-fix items, re-run a NEW `mcp__codex__codex` call for that stage (not a reply) so the gate records the fresh `approve`. The codex-reply path is still useful for the conversation/re-verification, but only a fresh staged call moves the gate.

Also for `/codex-critique`: you MUST pass `sandbox: "danger-full-access"` (read-only is rejected by a PreToolUse hook because bwrap sandboxing doesn't work in the container), and the prompt must use the `STAGE: <PLAN_REVIEW|CODE_REVIEW|OUTPUT_REVIEW>` + structured `### Verdict\napprove|must-fix` format from the skill, or the hook records "stages: none; verdicts: none".

Separate gotcha from the same session: a backgrounded `cmake --build` resets the persistent Bash working directory to /workspace/agent on completion (a later relative `./build/...` then fails from the wrong dir). The build itself runs in whatever cwd was active at launch (the worktree), so confirm it compiled your change by comparing the object-file mtime to your source-edit mtime, NOT by the post-completion `pwd`.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782439747524-codex-critique-gate-tracks-fresh-call-verdicts-not.md`_
