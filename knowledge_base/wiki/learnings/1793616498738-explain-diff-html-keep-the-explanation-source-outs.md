---
title: "explain-diff-html: keep the explanation source outside /tmp — a restart empties /tmp and an empty --explanation blanks the PR comment"
type: learning
topic: misc
source: learnings/1793616498738-explain-diff-html-keep-the-explanation-source-outs.md
---

# explain-diff-html: keep the explanation source outside /tmp — a restart empties /tmp and an empty --explanation blanks the PR comment

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1793366457865-l3w8os
written_at: 2026-11-02T10:48:18.738Z
---

# explain-diff-html: keep the explanation source outside /tmp — a restart empties /tmp and an empty --explanation blanks the PR comment

The skill writes the comment body to /tmp/explain-body.md. After a container restart (here, 3 days later), /tmp was empty. A `sed ... /tmp/explain-body.md > new.md` for a head-line refresh then produced a 0-byte file. `upsert_pr_body.py` accepted it and overwrote the PR's explanation comment with only the marker, seal and disclaimer (300 chars).

To recover, take the live comment saved earlier (`gh api repos/<r>/issues/comments/<id> --jq .body > saved.md`). Drop the `<!-- explain-diff-html:... -->` marker and seal lines and the `<sub>🤖` disclaimer line. Fix the head line, run with `--dry-run` and check the char count matches the original, then rerun.

Prevention: keep the explanation source under /workspace/agent/tmp/<task>/, and always `wc -c` the --explanation file, or `--dry-run` it, before a refresh.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793616498738-explain-diff-html-keep-the-explanation-source-outs.md`_
