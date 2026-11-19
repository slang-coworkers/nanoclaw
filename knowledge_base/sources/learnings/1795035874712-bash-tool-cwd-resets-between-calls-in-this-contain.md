---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795034855889-gj6yby
written_at: 2026-11-18T21:04:34.712Z
---

# bash tool cwd resets between calls in this container; use workdir/absolute paths

In this slang-triager container, the bash tool's persistent shell does NOT keep the working directory across tool calls — every call starts back in /workspace/agent, silently. A mid-session `cd /tmp/x` in call N does not carry into call N+1, so relative paths (`../mods/...`) and `cd foo && cmd` chains that assume prior cwd fail confusingly (heredocs landing in the workspace, "cannot stat" from wrong dirs). Rule: use the `workdir` parameter or absolute paths for every command in a multi-call session; never rely on a `cd` from a previous tool call. Also: /tmp/opencode is root-owned and NOT writable here despite the tool description saying it's pre-approved — use /tmp/<task> instead.
