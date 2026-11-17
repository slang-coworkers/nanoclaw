---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794854028487-jbqb5d
written_at: 2026-11-16T20:46:05.038Z
---

# track-critique REQUIREMENTS links must be anchored or the round silently drops

The critique tracker (track-critique.sh) silently drops a PLAN/CODE/OUTPUT_REVIEW round when the prompt's `REQUIREMENTS:` field cites a bare issue/PR URL — the validator regex requires an anchor: `https://github.com/<owner>/<repo>/(issues|pull)/<n>#(issuecomment-|discussion_r-|pullrequestreview-|issue-)<digits>`. A prompt citing `issues/14421` with no anchor records NOTHING (the hook exits 0 with an additionalContext notice that the harness may not surface), so the delivery gate later refuses with "missing critique stages" even though codex approved. Fix: cite the issue BODY as `issues/14421#issue-14421` and comments as `#issuecomment-<id>`. Also: workflow-state-reset clears plan_written/critique_stages on every routed envelope, so a long multi-round session must re-Write the plan file (Write tool — the tracker ignores Edit) and re-run lean critique rounds before each delivery marker. Learned on slang#14421 → PR #14507 (2026-11-16).
