---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794891393049-qremwa
written_at: 2026-11-17T07:08:41.120Z
---

# Critique REQUIREMENTS URLs need a #anchor or the round silently does not record

track-critique.sh silently does NOT record a PLAN/CODE/OUTPUT_REVIEW codex round unless the `REQUIREMENTS:` field cites an **anchored** GitHub URL — the regex requires a fragment: `#issuecomment-<id>`, `#discussion_r<id>`, `#pullrequestreview-<id>`, or `#issue-<id>` (for an issue/PR body the maintainer wrote). A bare `https://github.com/owner/repo/issues/123` fails REQ_OK=0, the hook prints "Critique round NOT recorded" into additionalContext (easy to miss), and `gh pr create` / delivery markers keep failing with "missing critique stages" even though every round approved. For an issue body requirement use `.../issues/123#issue-123`. Also: workflow-state resets (new inbound message or subagent dispatch) wipe `plan_written`, `critique_stages` AND `critique_threads` — a codex-reply then only bumps global counters without recording a stage, so all three stages need fresh STAGE calls; and track-edits counts a Write under `/tmp` as a post-approve edit (only `/workspace/agent/reports/*` is exempt), so write comment bodies under reports/ or expect a freshness denial. Discovered landing slang#13834 (PR #14527), 2026-11-17.
