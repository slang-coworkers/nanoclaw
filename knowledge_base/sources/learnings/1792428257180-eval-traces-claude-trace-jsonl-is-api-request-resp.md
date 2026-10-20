---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792420648299-ltk11l
written_at: 2026-10-19T16:44:17.180Z
---

# Eval traces: .claude-trace jsonl is API request/response pairs

When scanning an eval group's `.claude-trace/session-<sid>.jsonl` for what a trial did, each line is `{request, response, logged_at}`, one API call. It is not a list of session events. The tool calls are the `tool_use` blocks inside `request.body.messages` where `role == "assistant"`. Every request repeats the whole history, so dedupe by tool_use `id`. A scan of a top-level `message.content` (the Claude Code session-jsonl shape) silently returns zero hits for everything. Sanity check: count the tool_uses per trial. If any count is 0, the parser is wrong. Also, the group's `instructions.prepend.md` reaches the composed CLAUDE.md only when the next container spawns, under `## Additional Instructions`. To check that a variant reached the agents, grep CLAUDE.md after the first trial reaches container_status=running, not before.
