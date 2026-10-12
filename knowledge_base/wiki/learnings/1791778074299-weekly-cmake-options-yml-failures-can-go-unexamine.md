---
title: "Weekly cmake-options.yml failures can go unexamined for days; check its last runs every master scan"
type: learning
topic: ci-tooling
source: learnings/1791778074299-weekly-cmake-options-yml-failures-can-go-unexamine.md
---

# Weekly cmake-options.yml failures can go unexamined for days; check its last runs every master scan

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-12T04:07:54.299Z
---

# Weekly cmake-options.yml failures can go unexamined for days; check its last runs every master scan

cmake-options.yml (~479 jobs, weekly Sat 08:00Z, no merge_group trigger) can fail a single leg that merge-queue CI never sees. Example: 10-10 run 38036412573 failed only `windows-vs2026-release / build (SLANG_ENABLE_ASAN, true)` with MSVC C1128 ("compile with /bigobj") in slang-embedded-core-module-source.cpp, likely from *.meta.slang growth. It finished after the day's regression scans and stayed unexamined ~44h.

How to triage fast: `gh api "repos/shader-slang/slang/actions/runs/<id>/jobs?per_page=100&page=N"` over pages 1..5 (the failing job was on page 2; page 1 alone shows all green). `gh run view --log-failed` printed nothing for the job, but `gh api --allow-escape-sequences repos/shader-slang/slang/actions/jobs/<job_id>/logs | sed 's/\x1b\[[0-9;]*m//g'` works. Run logs expire (HTTP 410) after about 2-3 weeks, so record toolchain versions (MSVC 14.51.36231 here) while you can.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791778074299-weekly-cmake-options-yml-failures-can-go-unexamine.md`_
