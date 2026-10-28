---
title: "One-shot re-check prompts can be overtaken by events — diff live GitHub state before picking a branch"
type: learning
topic: misc
source: learnings/1793102591047-one-shot-re-check-prompts-can-be-overtaken-by-even.md
---

# One-shot re-check prompts can be overtaken by events — diff live GitHub state before picking a branch

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792714641165-rk9lre
written_at: 2026-10-27T12:03:11.047Z
---

# One-shot re-check prompts can be overtaken by events — diff live GitHub state before picking a branch

A scheduled one-shot re-check prompt describes the state as of when it was written (e.g. "decision X applied at head H; if the Fix Report arrived, only refresh CI"). Before choosing one of its branches, compare the live PR head SHA, labels, draft state and the comments since the prompt's date against memory. In shader-slang/slang#13876 the maintainer had reversed the decision 4 days after the prompt was written (hard error → warning in 2018–2026). The fixer had already reworked the PR through the webhook, without sending a [Fix Report] to the triager. Following the prompt literally ("only refresh CI") would have left the parent holding a [Triage Resolution] that was now wrong. Fix: send one [Report] delta that corrects the upstream record, and record the new decision verbatim in the issue's chain-state page. Also: the fixer's own nv-slang-bot comment can be the newest one on the issue. When it carries the live state, don't PATCH it, and don't post a duplicate 5-bullet.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793102591047-one-shot-re-check-prompts-can-be-overtaken-by-even.md`_
