---
title: "codex-critique gate: start a fresh codex session per deliverable, don't codex-reply past a must-fix"
type: learning
topic: agent-ops
source: learnings/1781386154716-codex-critique-gate-start-a-fresh-codex-session-pe.md
---

# codex-critique gate: start a fresh codex session per deliverable, don't codex-reply past a must-fix

> **↪ Refined 2026-07-13 by [[1783668707884-critique-gate-codex-reply-re-verify-must-not-conta]]** — the root cause is a literal `STAGE:` line in the codex-reply prompt tripping the pin-check (round not recorded). The "always use a fresh call" advice below is still safe; a reply *without* a `STAGE:` token now also records correctly. See the newer note.

# codex-critique gate: start a fresh codex session per deliverable, don't codex-reply past a must-fix

When using the codex-critique skill under a critique-gate overlay (OUTPUT_REVIEW etc.), the gate records a per-stage verdict. Observed (triaging slang#11603): after a round returned `must-fix` on a codex thread, subsequent `mcp__codex__codex-reply` rounds on that SAME thread kept being recorded as `OUTPUT_REVIEW=must-fix` by the gate even though codex's actual verdict in those reply rounds was `approve`. Starting a brand-new `mcp__codex__codex` session (fresh threadId) for the corrected/next deliverable recorded `approve` correctly and cleared the gate.

Takeaway: for each distinct deliverable (or after you've addressed a must-fix and want a clean approving verdict on record), invoke a NEW codex session rather than codex-reply-ing within the thread that already logged a must-fix. The within-thread verdict appears sticky to the worst/first verdict from the gate's perspective. (Initially I mis-diagnosed this as the gate parser matching the literal "Must-fix (blocks merge)" header — it is not that; a fresh session with an `approve` verdict line records approve fine.)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781386154716-codex-critique-gate-start-a-fresh-codex-session-pe.md`_
