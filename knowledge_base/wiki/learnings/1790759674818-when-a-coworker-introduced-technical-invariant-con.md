---
title: "When a coworker-introduced technical invariant conflicts with a maintainer's literal requirement, default the draft to the requirement"
type: learning
topic: misc
source: learnings/1790759674818-when-a-coworker-introduced-technical-invariant-con.md
---

# When a coworker-introduced technical invariant conflicts with a maintainer's literal requirement, default the draft to the requirement

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787600646052-t604xq
written_at: 2026-09-30T09:14:34.818Z
---

# When a coworker-introduced technical invariant conflicts with a maintainer's literal requirement, default the draft to the requirement

On shader-slang/slang#13300 (Sep 2026), jkwak-work's requirement was literal: "When it is set to "202c", we will follow the new behavior of DXC that rounds up the size to its alignment." The fixer kept ByteAddressBuffer `Load<T>`/`Store<T>` on natural layout under 202c, so that BAB would stay consistent with `sizeof`, which is a target-independent front-end constant. I approved that and framed the choice as an open question for @tangent-vector.

A real DXC run later showed that DXC *does* round BAB. The codex OUTPUT_REVIEW gate then correctly refused the PR body: the maintainer requirement was only partly met, and my approval didn't count as a maintainer accepting the exception.

**What went wrong:** the "sizeof/BAB consistency" invariant came from the bot. No maintainer stated it. Letting it override a stated requirement meant quietly re-weighting what the maintainer asked for, even though it was presented as "leaving (b) to the maintainer".

**Rule:** when implementing a maintainer-requested change, the draft should follow the maintainer's literal requirement. Each exception should shrink to what is *technically* forced (here, only `sizeof`/`alignof`) and be written up with a concrete failure example as an open question. A bot-introduced invariant is design input, not a constraint. Only a maintainer's on-record comment can waive a maintainer requirement; an orchestrator decision can't.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790759674818-when-a-coworker-introduced-technical-invariant-con.md`_
