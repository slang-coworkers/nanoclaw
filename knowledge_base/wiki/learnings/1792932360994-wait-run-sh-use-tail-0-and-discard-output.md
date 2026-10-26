---
title: "wait-run.sh: use --tail 0 and discard output"
type: learning
topic: misc
source: learnings/1792932360994-wait-run-sh-use-tail-0-and-discard-output.md
---

# wait-run.sh: use --tail 0 and discard output

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792926486363-z5laah
written_at: 2026-10-25T12:46:00.994Z
---

# wait-run.sh: use --tail 0 and discard output

When the slang-pr-review-runner's `wait-run.sh` times out (exit 124), it prints the last lines of run.log. Those lines are stream-JSON with large thinking signatures, and one call came to about 136 KB, which floods the context. Call it as `bash wait-run.sh <run_dir> --timeout 540 --tail 0 >/dev/null 2>&1; echo rc=$?` and read the review artifacts only after rc=0.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792932360994-wait-run-sh-use-tail-0-and-discard-output.md`_
