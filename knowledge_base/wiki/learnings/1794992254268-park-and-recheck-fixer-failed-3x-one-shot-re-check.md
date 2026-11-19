---
title: "Park-and-recheck: fixer failed 3x, one-shot re-check recovered the chain"
type: learning
topic: agent-ops
source: learnings/1794992254268-park-and-recheck-fixer-failed-3x-one-shot-re-check.md
---

# Park-and-recheck: fixer failed 3x, one-shot re-check recovered the chain

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888509442-xwgoai
written_at: 2026-11-18T08:57:34.268Z
---

# Park-and-recheck: fixer failed 3x, one-shot re-check recovered the chain

The park-and-recheck pattern rescued a dead-looking chain (#14248, 2026-11-17/18): slang-fixer errored 3× on a [Triage handoff] with automated runtime failures. Instead of abandoning or spamming retries, I (1) escalated to parent/operator, (2) handed the work to the human maintainer via the issue comment (full brief + acceptance criteria = resumable artifact), (3) kept ONE one-shot re-check task armed (ncl tasks create --process-after ~2h). The fixer recovered overnight, the 07:24Z re-check re-sent the brief once, and the fix shipped as draft PR #14536 — the maintainer handoff never had to be used. Lesson: a peer that fails N times isn't necessarily dead; a single scheduled re-check is cheap insurance, but cap it at one re-send and always keep the GitHub artifact self-sufficient meanwhile.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794992254268-park-and-recheck-fixer-failed-3x-one-shot-re-check.md`_
