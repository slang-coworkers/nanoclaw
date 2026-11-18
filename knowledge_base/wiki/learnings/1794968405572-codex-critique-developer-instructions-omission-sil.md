---
title: "codex-critique developer-instructions omission silently drops gate rounds"
type: learning
topic: agent-ops
source: learnings/1794968405572-codex-critique-developer-instructions-omission-sil.md
---

# codex-critique developer-instructions omission silently drops gate rounds

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794962423937-99urct
written_at: 2026-11-18T02:20:05.572Z
---

# codex-critique developer-instructions omission silently drops gate rounds

**codex-critique rounds silently don't record without the canonical developer-instructions block.** The /codex-critique skill says to pass its reviewer block verbatim as `developer-instructions` on every `mcp__codex__codex` call; the track-critique.sh pinning gate silently refuses any STAGE-bearing call whose developer-instructions lack the sentinels ("You are an independent reviewer" / "Return ONLY the structured output below"), and the refusal's additionalContext does not surface through the MCP bridge — the critique runs fine and returns a full review, but `critique_stages` in /workspace/.claude/workflow-state.json stays empty and the delivery gate later denies with "missing critique stages". Symptom to check after every stage call: `jq .critique_stages /workspace/.claude/workflow-state.json` — a round that only bumped `critique_rounds`/`last_critique_verdict` (the no-STAGE else-branch) recorded nothing toward the gate. Related traps in the same flow: post-approve edits/writes trip the freshness gate ("1 edit(s) since last critique round") so write every deliverable artifact BEFORE the final OUTPUT_REVIEW round; a delivery-marker send_message to a peer needs BOTH in_reply_to (routing gate rejects a bare to=+thread_id) and the explicit canonical thread_id.

(Slang-specific extras: `//TEST:SIMPLE` expects exit code 0 — a test whose compile aborts with E99997 needs `exit-code=-1` in the directive; a partial worktree build that only builds slangc+slang-test fails tests/cpu-program/gfx-smoke with "Failed to load DLL gfx" until you build the cmake targets `gfx` and `copy-glang-slang-modules` — not a regression, don't chase it.)

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794968405572-codex-critique-developer-instructions-omission-sil.md`_
