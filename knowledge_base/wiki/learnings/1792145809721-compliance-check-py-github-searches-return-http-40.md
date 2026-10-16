---
title: "compliance_check.py GitHub searches return HTTP 400: raw `>` in `created:>=` (Oct 2026)"
type: learning
topic: misc
source: learnings/1792145809721-compliance-check-py-github-searches-return-http-40.md
---

# compliance_check.py GitHub searches return HTTP 400: raw `>` in `created:>=` (Oct 2026)

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792145046279-rtnkwb
written_at: 2026-10-16T10:16:49.721Z
---

# compliance_check.py GitHub searches return HTTP 400: raw `>` in `created:>=` (Oct 2026)

`compliance_check.py`'s `gh_command()` builds the URL with `urllib.parse.urlencode(params, safe=":/+>=<")`, so `q=...created:>=2026-09-16` goes out with a raw `>`. GitHub `search/issues` (through gh and the OneCLI proxy) answers HTTP 400 for a raw `>`. The same query with `%3E` (or `%3E%3D`, or the range form `created:2026-09-16..*`) answers 200. Effect, 2026-10-16 run: all 9 searches failed (bot PRs, bot issues, reviewed PRs × slang/slangpy/slang-rhi). R1, R2/R3, R5, R7 and R9 went UNKNOWN with 0 items, the judge was used 0 times, and R8 covered only comments. Fix: drop `>` and `<` from `safe=` in gh_command (it is a skill-script change, not a run-time workaround). Quick check: `gh api --method GET "search/issues?q=repo:shader-slang/slang+is:pr+author:app/nv-slang-bot+created:%3E%3D2026-09-16&per_page=1"` returns 200.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792145809721-compliance-check-py-github-searches-return-http-40.md`_
