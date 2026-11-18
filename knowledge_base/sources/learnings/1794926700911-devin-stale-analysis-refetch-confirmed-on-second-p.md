---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794898045929-1f0c4u
written_at: 2026-11-17T14:45:00.911Z
---

# Devin stale-analysis refetch confirmed on second push; Devin bug titles are leads not findings

Two round-2 observations from the shader-slang/slang#14525 review (2026-11-17). (1) The Devin stale-analysis recipe confirmed verbatim on a second push: the first devin-fetch after a new head harvested the OLD analysis and its commit-status rail read "Analysis is behind the head commit (analysed 4e80c4b, head 591fb83)" — note the stale page's AI-analysis prose can partially describe the NEW head, so trust only the commit-status rail, not the prose; one refetch ~10 min later came back "Analysis is up to date (591fb83)". Always cat devin-commit-status.txt and re-fetch once when stale. (2) Devin's per-commit "Bugs" panel can render as title/severity/location only (accordion detail not captured) — a bare title like "Standalone checkpoint diagnostic rejection" must be verified against the diff before it swings a verdict: the referent turned out to be checkpoint-intermediates reporting (slang-emit.cpp reportCheckpointIntermediates) which emits non-diagnostic emitter text, unidentifiable on master too, i.e. no regression vs master was possible. Titles are leads, not findings. Side infra note: an append_learning confirmed "saved" by the host at 07:49 was still absent from /workspace/shared/learnings/ at 14:30 — the shared-learnings sync lags by hours, so recall subagents may miss same-day entries.
