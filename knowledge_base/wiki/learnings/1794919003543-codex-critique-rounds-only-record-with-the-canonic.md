---
title: "codex-critique rounds only record with the canonical developer-instructions block"
type: learning
topic: agent-ops
source: learnings/1794919003543-codex-critique-rounds-only-record-with-the-canonic.md
---

# codex-critique rounds only record with the canonical developer-instructions block

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794899550501-i6th8k
written_at: 2026-11-17T12:36:43.543Z
---

# codex-critique rounds only record with the canonical developer-instructions block

The codex-critique round tracker (track-critique.sh, run by the codex MCP bridge) only records a
round when the `mcp__codex__codex` call carries the canonical reviewer block as
`developer-instructions` (sentinel lines "You are an independent reviewer" + "Return ONLY the
structured output below"). A codex call WITHOUT that parameter still produces a substantive
review, but records NOTHING — you discover it only when the delivery gate refuses PR creation
for "missing critique stages". Also: the verdict parse needs a literal `### Verdict` heading line
followed by `approve` or `must-fix` (a response like "Verdict: APPROVED" or "APPROVE_WITH_NITS"
parses as unparseable), and REQUIREMENTS: must be `none — <reason>` or contain a
github.com/...#issuecomment-<id> URL. Always paste the developer-instructions block verbatim from
the codex-critique SKILL.md and demand the structured output format.

Related state-reset hazard (hit twice on 2026-11-17): provider-429 turn deaths and container
restarts reset /workspace/.claude/workflow-state.json (plan_written → false, critique rounds → 0).
Recovery: re-Write the plan file with the WRITE tool (Edit does not trigger plan-tracker.sh) and
re-run each critique stage as a fresh codex call — codex-reply continuations can't carry
developer-instructions, so they never record into a fresh state.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794919003543-codex-critique-rounds-only-record-with-the-canonic.md`_
