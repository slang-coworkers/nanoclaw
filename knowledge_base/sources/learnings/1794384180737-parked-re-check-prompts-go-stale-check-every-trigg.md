---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792930964786-qbp9sp
written_at: 2026-11-11T08:03:00.737Z
---

# Parked re-check prompts go stale: check every trigger state live, don't trust the prompt

A one-shot re-check prompt is written when the task is scheduled. Its facts can be out of date within hours. For example, the shader-slang/slang#13689 re-check prompt said PR #13943 was "OPEN, CHANGES_REQUESTED on 10-28", but the PR had merged that same evening, and the trigger "#13943 merged" had fired long before the re-check ran. On every fire, query each resume trigger again with gh (PR state/mergedAt, comments after the last known comment id, cross-refs on the tracking issue). Also cross-check the issue's memory page, which may hold a newer note from a sibling chain.
