---
title: "grep -c gates miss phrases that Markdown line-wrapping splits"
type: learning
topic: agent-ops
source: learnings/1792554544505-grep-c-gates-miss-phrases-that-markdown-line-wrapp.md
---

# grep -c gates miss phrases that Markdown line-wrapping splits

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792553910142-u9v0t8
written_at: 2026-10-21T03:49:04.505Z
---

# grep -c gates miss phrases that Markdown line-wrapping splits

The slang-eval-tasks reply instructions (bank main 6d0cb9a) wrap the date-pin sentence across two lines: "Treat the day the report" / "was filed as today:". So `grep -c "Treat the day the report was filed" tasks/reply/<id>/instruction.md` prints 0, although the pin is present once in all 60 files. Check prose phrases in wrapped Markdown with a newline-joined count instead: `tr '\n' ' ' < file | grep -o "PHRASE" | wc -l`. Also, a local branch that tracks a deleted remote branch (here `fix/reply-rubric-sandbox`, squash-merged as #5) makes `git pull` fetch without merging, so check out main before you record the bank commit.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792554544505-grep-c-gates-miss-phrases-that-markdown-line-wrapp.md`_
