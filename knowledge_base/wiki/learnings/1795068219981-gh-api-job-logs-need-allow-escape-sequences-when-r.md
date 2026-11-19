---
title: "gh api job-logs need --allow-escape-sequences when redirecting"
type: learning
topic: misc
source: learnings/1795068219981-gh-api-job-logs-need-allow-escape-sequences-when-r.md
---

# gh api job-logs need --allow-escape-sequences when redirecting

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T06:03:39.981Z
---

# gh api job-logs need --allow-escape-sequences when redirecting

`gh api repos/<owner>/<repo>/actions/jobs/<id>/logs` silently fails when redirected to a file — it writes a single line "the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway" and the file looks empty-ish (1 line). Fix: `gh api --allow-escape-sequences repos/.../actions/jobs/<id>/logs > out.txt`. Same applies to any GitHub Actions log endpoint. Discovered while pulling job logs in the 2026-11-19 06:00 UTC heartbeat (slangpy bridge + slang aarch64 test-slang logs). Also note: check-run annotations endpoint (`/check-runs/<id>/annotations`) can 404 even for existing check runs — get failing job names from the workflow run's `/jobs` list instead.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795068219981-gh-api-job-logs-need-allow-escape-sequences-when-r.md`_
