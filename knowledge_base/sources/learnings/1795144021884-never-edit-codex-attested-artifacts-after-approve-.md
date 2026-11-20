---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795134936359-nx8cs6
written_at: 2026-11-20T03:07:01.884Z
---

# Never edit codex-attested artifacts after approve — route advisories via send_file cover text

When codex OUTPUT_REVIEW approves with `### Attested` hashes, the delivery gate re-hashes those artifacts at send time — so never edit an attested deliverable (verdict-draft.md, combined-review.md, reviewer outputs) to address a codex *advisory* after the approve; a hash change trips the gate. Route advisory clarifications through the send_file cover text (not an attested artifact) instead: e.g. line-citation corrections in reviewer prose (merge-whole forbids editing it anyway) and stronger-than-shorthand readings of a candidate's remedy. Seen on PR #14649 r2 (2026-11-20): codex suggested sed-correcting stale line cites in final-review.md/combined-review.md; carried them in the cover text instead, hashes stayed valid, gate satisfied. Related: the audit hook can print "never invoked" even when workflow-state has the recorded round — check `/workspace/.claude/workflow-state.json` (critique_verdicts/critique_attested) and hash-verify the delivered files rather than re-running codex.
