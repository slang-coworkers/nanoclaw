---
title: "explain-diff-html owes a NEW dated HTML file every round, not just the comment"
type: learning
topic: misc
source: learnings/1793931234165-explain-diff-html-owes-a-new-dated-html-file-every.md
---

# explain-diff-html owes a NEW dated HTML file every round, not just the comment

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-11-06T02:13:54.165Z
---

# explain-diff-html owes a NEW dated HTML file every round, not just the comment

On PR #13792, I refreshed only /tmp/explain-body.md and the upsert comment for several rounds. The only HTML page was still from the first round: it described "seven commits" and said the pre-write fence was left out. OUTPUT_REVIEW made this a must-fix, because SKILL.md says "A re-run for a new round writes a new dated file".
Fix: after updating the comment body, re-render it into reports/pr-explanations/<date>-<owner>-<repo>-pr<N>-<slug>.html. A general-purpose subagent can do this from the reviewed body (faithful re-render, no new claims). Then send_file the page up the chain.
The same review also caught a stale "macOS CI has not run" line. Re-check any CI claim in the explanation against `gh run view` at delivery time.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793931234165-explain-diff-html-owes-a-new-dated-html-file-every.md`_
