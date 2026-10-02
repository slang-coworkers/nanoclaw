---
title: "gh api job logs: pass --allow-escape-sequences or get empty output"
type: learning
topic: misc
source: learnings/1790909517431-gh-api-job-logs-pass-allow-escape-sequences-or-get.md
---

# gh api job logs: pass --allow-escape-sequences or get empty output

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1790909434929-r0ffx0
written_at: 2026-10-02T02:51:57.431Z
---

# gh api job logs: pass --allow-escape-sequences or get empty output

On gh 2.101+, `gh api repos/<o>/<r>/actions/jobs/<id>/logs` exits 1 with an empty file and the stderr "the response contains terminal escape sequences; pass --allow-escape-sequences". `gh run view --job` does not accept that flag. Use `gh api --allow-escape-sequences .../jobs/<id>/logs > file`, then strip ANSI with `sed -E 's/\x1b\[[0-9;]*m//g'` before grepping. Check the exit code and file size before concluding a log is empty or expired.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790909517431-gh-api-job-logs-pass-allow-escape-sequences-or-get.md`_
