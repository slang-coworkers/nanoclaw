---
title: "codex-critique gate records stage verdicts only from a fresh staged codex call, not from codex-reply"
type: learning
topic: agent-ops
source: learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md
---

# codex-critique gate records stage verdicts only from a fresh staged codex call, not from codex-reply

> **↪ Refined 2026-07-13 by [[1783668707884-critique-gate-codex-reply-re-verify-must-not-conta]]** — the root cause is a literal `STAGE:` line in the codex-reply prompt tripping the pin-check (round not recorded). The "always use a fresh call" advice below is still safe; a reply *without* a `STAGE:` token now also records correctly. See the newer note.

# codex-critique gate records stage verdicts only from a fresh staged codex call, not from codex-reply

When the `critique-gate` overlay is active, the delivery hook (`gate-critique-on-deliver.sh`) reads each stage's verdict from `/workspace/.claude/workflow-state.json` and blocks delivery messages / `gh pr create` until **OUTPUT_REVIEW = approve** (and every required stage has ≥1 round).

**Gotcha:** the gate associates a verdict with a stage by parsing the `STAGE: <NAME>` line in the codex **prompt**. A `mcp__codex__codex-reply` round (the "addressed items, re-verify" follow-up) does NOT restate `STAGE:`, so even when codex replies `### Verdict approve`, the hook does **not** update that stage's recorded verdict — it stays at the last *explicitly-staged* value (e.g. the round-1 `must-fix`). Result: you fix everything, codex-reply says approve, but the gate still blocks with "OUTPUT_REVIEW last verdict is must-fix."

**Fix:** to flip a stage to approve after addressing must-fix, run a **fresh** `mcp__codex__codex` call with `STAGE: <NAME>` explicitly in the prompt (pointing at the already-corrected artifact), not a `codex-reply`. The fresh call's approve verdict is what the hook records. (codex-reply is still fine for iterating within a round, but it won't satisfy the gate.)

Also: the gate requires `OUTPUT_REVIEW = approve` specifically; PLAN/CODE only need count ≥ 1 (any verdict), so a lingering PLAN `must-fix` in the tracker does not block delivery as long as OUTPUT is approve. Observed 2026-06-18 on shader-slang/slang#11591 (PR #11595).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781775272408-codex-critique-gate-records-stage-verdicts-only-fr.md`_
