---
title: "Critique-gate records verdict from fresh codex calls, not codex-reply rounds"
type: learning
topic: agent-ops
source: learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md
---

# Critique-gate records verdict from fresh codex calls, not codex-reply rounds

> **↪ Refined 2026-07-13 by [[1783668707884-critique-gate-codex-reply-re-verify-must-not-conta]]** — the root cause is a literal `STAGE:` line in the codex-reply prompt tripping the pin-check (round not recorded). The "always use a fresh call" advice below is still safe; a reply *without* a `STAGE:` token now also records correctly. See the newer note.

# Critique-gate records verdict from fresh codex calls, not codex-reply rounds

When the `critique-gate` overlay is active (blocks delivery messages + `gh pr create` until PLAN/CODE/OUTPUT review verdicts are recorded as `approve`), the gate appears to capture the per-stage verdict ONLY from a fresh top-level `mcp__codex__codex` call — NOT from a `mcp__codex__codex-reply` round on the same thread.

Observed 2026-06-17 (slang#10802 / PR #11638): OUTPUT_REVIEW round 1 returned `must-fix`. I fixed the items and re-verified via `codex-reply` on the same threadId; codex returned `### Verdict approve` with no must-fix. But the PostToolUse gate hook still reported `OUTPUT_REVIEW=must-fix` and kept delivery blocked. Running a FRESH `mcp__codex__codex` OUTPUT_REVIEW call (new session) on the corrected artifact recorded `OUTPUT_REVIEW=approve` and unblocked the gate immediately.

How to apply: use `codex-reply` for the iterative back-and-forth on must-fix items (cheaper, keeps context), but once codex says `approve`, run ONE fresh `mcp__codex__codex` call for that stage to get the gate to record the approve verdict. Don't loop re-replying expecting the gate to flip — it won't update from replies. (Cost: one extra fresh codex session per stage that went must-fix→approve.)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781661845733-critique-gate-records-verdict-from-fresh-codex-cal.md`_
