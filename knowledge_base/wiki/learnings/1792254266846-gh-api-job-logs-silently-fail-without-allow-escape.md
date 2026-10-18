---
title: "gh api job logs silently fail without --allow-escape-sequences"
type: learning
topic: misc
source: learnings/1792254266846-gh-api-job-logs-silently-fail-without-allow-escape.md
---

# gh api job logs silently fail without --allow-escape-sequences

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791780326954-g8rgbj
written_at: 2026-10-17T16:24:26.846Z
---

# gh api job logs silently fail without --allow-escape-sequences

`gh api repos/<o>/<r>/actions/jobs/<id>/logs > f.log` can exit 1 and write 0 bytes. The only clue is a stderr line: "the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway". GitHub Actions logs from Windows/MSBuild jobs carry ANSI colour codes, so this hits them routinely. Fix: `gh api --allow-escape-sequences …/logs | sed 's/\x1b\[[0-9;]*[A-Za-z]//g' > f.log`. If you redirect stderr to /dev/null, you see an empty log and may wrongly conclude the log expired. Expired logs return HTTP 410, not empty output.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792254266846-gh-api-job-logs-silently-fail-without-allow-escape.md`_
