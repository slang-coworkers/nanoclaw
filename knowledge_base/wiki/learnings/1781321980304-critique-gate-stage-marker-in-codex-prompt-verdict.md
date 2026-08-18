---
title: "critique-gate: STAGE marker in codex PROMPT + '### Verdict' block in codex RESPONSE, one call per stage"
type: learning
topic: agent-ops
source: learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md
---

# critique-gate: STAGE marker in codex PROMPT + "### Verdict" block in codex RESPONSE, one call per stage

When the `critique-gate` overlay is active (marker file `/workspace/agent/.overlay-critique-gate` exists), delivery actions — `[Fix Report]`/`[Resolution]`/etc. send_message AND `gh pr create` / `gh api .../pulls` — are BLOCKED by PreToolUse hook `/app/hooks/gate-critique-on-deliver.sh` until codex critique is recorded in a SPECIFIC machine-parseable format. A combined single codex call with "**PLAN**/**CODE**/**OUTPUT**" headers does NOT satisfy it — the tracker (`/app/hooks/track-critique.sh`) reports "stages: none; verdicts: none" and the gate keeps denying.

**Required format (learned the hard way — 2 wasted rounds):**
1. Read `/workspace/agent/.critique-required-stages` (JSON array, e.g. `["PLAN_REVIEW","CODE_REVIEW","OUTPUT_REVIEW"]`). If the file is absent/empty, the gate falls back to "any 1 critique round" and a single codex call suffices.
2. If it lists stages, make ONE separate `mcp__codex__codex` call PER stage (NOT codex-reply — replies don't carry the STAGE marker; they inherit the parent thread's stage). Each call:
   - The PROMPT must contain a line matching `STAGE:[[:space:]]*[A-Z_]+`, e.g. a literal `STAGE: PLAN_REVIEW`. The stage NAME is read from the prompt, not the response.
   - The codex RESPONSE must end with two lines: a line `### Verdict` immediately followed by a line containing only the verdict word (`approve` or `must-fix`). Parser: `sed -n '/^### *Verdict/{n;p;}'`. Instruct codex explicitly to end with exactly those two lines.
3. The gate requires every listed stage recorded count>=1 AND, if `OUTPUT_REVIEW` is required, its last verdict == `approve`. State lives in `/workspace/.claude/workflow-state.json` (`.critique_stages`, `.critique_verdicts`).
4. The PostToolUse hook surfaces `Critique round N recorded (stages: …; verdicts: …)` after each codex call — use it to confirm the stage registered before moving on. Make the calls sequentially (the hook does a jq read-modify-write of the shared state file; parallel calls can race and drop a stage).

Soft cap: after 3 gate denials in a session it yields with a "stuck" warning — but don't rely on that; format it right the first time. Also: the codex `model` override (e.g. gpt-5.2-codex) is rejected 401 ("key can only access default-models") — omit `model`, use the default.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781321980304-critique-gate-stage-marker-in-codex-prompt-verdict.md`_
