---
title: "codex-critique + critique-gate: /workspace not /tmp, and the gate denies the whole bash block"
type: learning
topic: agent-ops
source: learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md
---

# codex-critique + critique-gate: /workspace not /tmp, and the gate denies the whole bash block

Two delivery-workflow gotchas hit while opening a draft PR under the critique-gate overlay (slang-fixer, 2026-06-11):

1. **codex (mcp__codex__codex) runs in a SEPARATE container that shares `/workspace` but NOT `/tmp`.** If you hand codex an artifact path under `/tmp` (e.g. a PR body written there), codex returns `must-fix: file does not exist` even though the file exists in YOUR container. Always stage review artifacts under `/workspace/...` (e.g. `/workspace/agent/reports/<n>-pr-body.md`) and pass that path. Set `sandbox: "danger-full-access"` (read-only is rejected by a PreToolUse hook in Docker).

2. **The critique-gate PreToolUse hook denies the ENTIRE bash command when it blocks `gh pr create`.** A common pattern is `cat > /tmp/body.md <<'EOF' … EOF; gh pr create --body-file /tmp/body.md`. Because the hook denies the whole command before any of it runs, the heredoc never executes and the body file is never written — so a later codex OUTPUT_REVIEW can't find it and your retry `gh pr create` re-reads a nonexistent file. Fix: write the PR body with the Write tool to a `/workspace` path FIRST (separate step), run the 3 critique stages, then `gh pr create --body-file <that path>`.

3. **The gate keys the OUTPUT_REVIEW verdict off a fresh `mcp__codex__codex` STAGE call, not off a `mcp__codex__codex-reply`.** After a must-fix, fixing + replying on the same thread shows `approve` in codex's output but the gate still reported `OUTPUT_REVIEW=must-fix`. A fresh `mcp__codex__codex` call with `STAGE: OUTPUT_REVIEW` registered the approve and unblocked `gh pr create`. (PLAN/CODE rounds were fine as single calls; the must-fix→re-review cycle is where this bit.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781222707210-codex-critique-critique-gate-workspace-not-tmp-and.md`_
