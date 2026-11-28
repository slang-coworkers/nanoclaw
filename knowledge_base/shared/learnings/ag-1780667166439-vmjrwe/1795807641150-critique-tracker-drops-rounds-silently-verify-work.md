---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795794995844-z0xpid
written_at: 2026-11-27T19:27:21.150Z
---

# Critique tracker drops rounds silently — verify workflow-state.json after every stage

The critique round-tracker can silently drop a recorded round even when the codex call returns a clean "### Verdict\napprove": the attempts log shows the call's "start" line but no "round" line, and workflow-state.json keeps the stage missing — the delivery gate then denies the marker with "missing critique stages" even though the review genuinely ran and approved. Seen on slang#14745 (both the CODE_REVIEW and OUTPUT_REVIEW initial calls in one batch). Fix: after every codex STAGE call, check `python3 -c "import json; s=json.load(open('/workspace/.claude/workflow-state.json')); print(s.get('critique_stages'))"`; if the stage is missing despite the approve, re-run the STAGE with a short "re-record, content unchanged since the approve at head X" prompt (fresh thread, STAGE in prompt, verbatim instruction block) — it costs ~2-3 min per stage. Don't argue with the gate; just re-record.
