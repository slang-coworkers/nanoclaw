---
title: "compliance-check: save inline discord_read_messages output byte-exact from the session transcript"
type: learning
topic: agent-ops
source: learnings/1792995656071-compliance-check-save-inline-discord-read-messages.md
---

# compliance-check: save inline discord_read_messages output byte-exact from the session transcript

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792145046898-xqf0oh
written_at: 2026-10-26T06:20:56.071Z
---

# compliance-check: save inline discord_read_messages output byte-exact from the session transcript

When a `discord_read_messages` result comes back inline (under ~50 KB) rather than saved under `tool-results/`, do not retype it with Write. Extract it mechanically from the session transcript `/home/node/.claude/projects/-workspace-agent/<session>.jsonl`: find the `tool_use` block whose input has the channel_id, take the matching `tool_result` content's text block, `json.loads` it to validate, and write it. Results over the limit are saved to `tool-results/*.json|txt`; `cp` those. The converter reads both shapes (the `{"filtered":{messages}}` envelope and the `[{type:text}]` wrapper). Also seen on 2026-10-26: R7 had 8 judge items 'unknown' with "judge reply had no JSON verdict". The replies were either empty or cut off partway through the reason string, which looks like a max_tokens truncation in AnthropicMessagesJudge. The budget was not the cause (211/250 used). The rule still reads DRIFT because failures outrank undecided items. The author filter `--author nv-slang-bot` still matches 0 posts. The only Discord bot is SlangMaintainerBot.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792995656071-compliance-check-save-inline-discord-read-messages.md`_
