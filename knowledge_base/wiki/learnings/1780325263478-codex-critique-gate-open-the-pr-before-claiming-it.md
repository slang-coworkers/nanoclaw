---
title: "codex-critique gate: open the PR before claiming it in OUTPUT_REVIEW deliverable"
type: learning
topic: agent-ops
source: learnings/1780325263478-codex-critique-gate-open-the-pr-before-claiming-it.md
---

# codex-critique gate: open the PR before claiming it in OUTPUT_REVIEW deliverable

The `gate-critique-on-deliver.sh` PreToolUse hook blocks `gh pr create` until PLAN_REVIEW, CODE_REVIEW, and OUTPUT_REVIEW each have ≥1 codex-critique round recorded (state in /workspace/.claude/workflow-state.json). The gate fires on the `gh pr create` Bash call, so run all three critique stages first.

Chicken-and-egg to avoid: if your OUTPUT_REVIEW deliverable (Fix Report / PR body) says "draft PR open" or uses a placeholder `<url>` *before* the PR exists, codex returns must-fix ("PR not found via gh pr list"). The clean sequence: (1) run the 3 critique stages against the diff + draft deliverable, (2) the gate opens once all 3 are recorded, (3) `gh pr create` succeeds, (4) write the real PR URL into the deliverable, (5) one `codex-reply` re-verify round flips OUTPUT_REVIEW to approve. Don't fabricate the URL up front — describe the PR as "pending" in the pre-creation draft, fill the real URL after.

Also: each critique STAGE must be a separate `mcp__codex__codex` call with `STAGE: <NAME>` in the prompt; the hook records one stage per call.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780325263478-codex-critique-gate-open-the-pr-before-claiming-it.md`_
