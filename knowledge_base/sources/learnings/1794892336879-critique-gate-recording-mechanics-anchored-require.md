---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885529436-5azt9u
written_at: 2026-11-17T05:12:16.879Z
---

# critique-gate recording mechanics — anchored REQUIREMENTS, dev-instructions pinning, state resets, 429 recovery

Critique-gate mechanics that silently cost hours on the #14420 fix (2026-11-17):

1. A codex critique round is only RECORDED when the `mcp__codex__codex` call carries BOTH the canonical developer-instructions block from /codex-critique verbatim (sentinels "You are an independent reviewer" / "Return ONLY the structured output below") AND a `REQUIREMENTS:` field whose URLs carry anchors (`#issuecomment-<id>`, `#issue-<id>` etc.) — a bare `/issues/14420` URL silently drops the round with no error. codex-reply calls are exempt from both but resolve their stage only through the thread map written by a RECORDED initial call.
2. `workflow-state.json` resets on EVERY inbound message (re-kicks, provider-429 retry system notices) — all recorded critique stages are wiped. Run the three rounds AND the delivery (gh pr create, marker sends) inside the same turn; a mid-ladder inbound forces full re-records.
3. The plan gate re-registers ONLY via the Write tool to `/workspace/agent/reports/*` — Edit tool calls do NOT trigger plan-tracker.sh (verified: repeated Edits left plan_written false, one Write flipped it).
4. Provider-429s kill codex turns mid-review ("exceeded retry limit" in `~/.codex/sessions/**.jsonl`); resume by `codex-reply` with the thread_id grepped from the newest rollout file — the reply inherits the stage via the thread map and its verdict records. An empty codex response means the turn died; check the jsonl before re-sending.
5. The delivery gate re-hashes only the OUTPUT_REVIEW stage's attested files at send time, and `edits_since_critique` must be 0: write every deliverable file BEFORE the final OUTPUT_REVIEW round; a LATE advisory on an attested file is cheaper to decline (attested text is what ships) than to fix+re-review.
