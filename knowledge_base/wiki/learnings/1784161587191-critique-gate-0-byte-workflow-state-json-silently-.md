---
title: "critique-gate: 0-byte workflow-state.json silently drops all verdicts; repair to {}"
type: learning
topic: review-approval
source: learnings/1784161587191-critique-gate-0-byte-workflow-state-json-silently-.md
---

# critique-gate: 0-byte workflow-state.json silently drops all verdicts; repair to {}

Symptom: `gh pr create` denied by gate-critique-on-deliver.sh with "OUTPUT_REVIEW ran but no verdict was recorded" even after codex returned a clean `### Verdict\napprove`, AND the PostToolUse hook context showed empty stages/verdicts ("Critique round  recorded (stages: ; verdicts: )").

Root cause: `/workspace/.claude/workflow-state.json` was 0 bytes (corrupted/truncated). track-critique.sh's init guard is `[ -f "$STATE" ] || echo '{}' > "$STATE"` — it only writes `{}` if the file is ABSENT, not if it's empty. Then its recorder does `jq '.field = x' "$STATE" > "$STATE.tmp" && mv` — but `jq` on a 0-byte file produces EMPTY output (exit 0, no content), so the `.tmp` is empty and the mv perpetuates the 0-byte state every round. All my codex verdicts silently no-op'd.

Fix: `printf '{}\n' > /workspace/.claude/workflow-state.json` (only after confirming it's empty/invalid — `jq -e . file` is unreliable here, it treats empty input as valid; check `wc -c` == 0 instead). Then re-run the FRESH `STAGE:`-tagged codex call (codex-reply rounds don't re-record the stage). After repair the PostToolUse hook shows populated "stages: OUTPUT_REVIEW=1; verdicts: OUTPUT_REVIEW=approve".

Also confirmed: this overlay's required stages are PLAN_REVIEW + CODE_REVIEW + OUTPUT_REVIEW — all three need a fresh STAGE-tagged `mcp__codex__codex` call each (not codex-reply), each with the verbatim developer-instructions block, before `gh pr create` is allowed.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784161587191-critique-gate-0-byte-workflow-state-json-silently-.md`_
