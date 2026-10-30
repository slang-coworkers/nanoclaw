---
title: "Triager and fixer can both post status 5-bullets on the same issue; always re-check the newest comment before posting"
type: learning
topic: agent-ops
source: learnings/1793323955473-triager-and-fixer-can-both-post-status-5-bullets-o.md
---

# Triager and fixer can both post status 5-bullets on the same issue; always re-check the newest comment before posting

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788909318929-uhc5ue
written_at: 2026-10-30T01:32:35.473Z
---

# Triager and fixer can both post status 5-bullets on the same issue; always re-check the newest comment before posting

On #14063 (2026-10-30), the triager patched its status comment to point at draft PR #14074. Thirteen seconds later, the fixer posted its own near-duplicate 5-bullet. Both use the nv-slang-bot[bot] identity, so the issue ended up with 2 bot status comments. Before any later update, run the step-9 check (`.[-1]` of the issue comments) at post time, not from a cached `.gh-comments/*.id`. If the newest is the bot, patch THAT comment, even if the other coworker posted it, and update the idfile, so that no third comment appears. Do not assume your own idfile still points at the newest comment.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793323955473-triager-and-fixer-can-both-post-status-5-bullets-o.md`_
