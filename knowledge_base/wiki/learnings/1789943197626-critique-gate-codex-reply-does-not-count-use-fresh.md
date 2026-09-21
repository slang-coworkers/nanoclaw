---
title: "critique-gate: codex-reply does NOT count — use fresh mcp__codex__codex with verbatim developer-instructions each round"
type: learning
topic: agent-ops
source: learnings/1789943197626-critique-gate-codex-reply-does-not-count-use-fresh.md
---

# critique-gate: codex-reply does NOT count — use fresh mcp__codex__codex with verbatim developer-instructions each round

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789937537031-ls299k
written_at: 2026-09-20T22:26:37.626Z
---

# critique-gate: codex-reply does NOT count — use fresh mcp__codex__codex with verbatim developer-instructions each round

Process learning for the [critique-gate] overlay (fires when a `[Resolution]`/verdict/delivery marker is emitted):

- The gate records a critique round ONLY when the codex call carries the canonical `/codex-critique` `developer-instructions` block verbatim (hook checks the sentinel lines "You are an independent reviewer" / "Return ONLY the structured output below"). It requires every required stage ≥1 AND the OUTPUT_REVIEW verdict = `approve`.
- **`mcp__codex__codex-reply` has NO `developer-instructions` parameter**, so a reply is NOT recorded toward the gate — even though the skill's "Rounds" section says to use codex-reply for rounds 2/3. In practice, to get a RECORDED round you must call fresh `mcp__codex__codex` each time WITH the verbatim `developer-instructions` block. You lose thread continuity, so re-supply full context ("re-review after must-fix; items were X,Y,Z; I addressed them by…") in the prompt each round.
- Use `sandbox: "danger-full-access"` (a PreToolUse hook rejects any other value inside the container — bwrap sandboxing doesn't work in Docker). Set `cwd` to the repo (e.g. `/workspace/agent/slang`) so codex can read source and run `gh pr diff`. Pass FILE PATHS, not contents.
- The `### Attested` sha256 hashes bind the verdict to the exact files reviewed; the gate re-hashes at send time and DENIES if the deliverable changed after the approve. So do NOT edit the approved deliverable before sending.
- It works: on #13189 the gate caught a wrong finding I was about to send (a bogus layoutMap sibling-cache collision), forced a retraction, and converged over ~4 rounds to an accurate, well-hedged advisory. Budget the rounds — each recorded round is a full Opus codex run (~$0.15-0.9 here). Steady convergence (each round resolving prior items, surfacing narrower ones) is NOT the "3 unresolved rounds → escalate" deadlock case; just keep fixing.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789943197626-critique-gate-codex-reply-does-not-count-use-fresh.md`_
