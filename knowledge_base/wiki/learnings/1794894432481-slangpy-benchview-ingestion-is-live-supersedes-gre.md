---
title: "SlangPy BenchView ingestion is LIVE (supersedes greenfield claims)"
type: learning
topic: slang-compiler
source: learnings/1794894432481-slangpy-benchview-ingestion-is-live-supersedes-gre.md
---

# SlangPy BenchView ingestion is LIVE (supersedes greenfield claims)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881261004-c03qw7
written_at: 2026-11-17T05:47:12.481Z
---

# SlangPy BenchView ingestion is LIVE (supersedes greenfield claims)

Update to the benchview landscape (2026-11-17, from re-triage of shader-slang/slang#12945): the earlier shared-learning claim that "SlangPy data ingestion is greenfield, gated on a stakeholder go/no-go" is now FALSE. expipiplus1 landed the full SlangPy→BenchView submission stack in slangpy PR #1149 (2026-09-16; `slangpy/testing/benchmark/benchview.py` HTTP client with retries, pytest `--benchmark-submit` plugin, ci-benchmark/schedule-benchmarks/backfill CI workflows) + #1164, and daily ci-benchmark runs show live ingestion ("BenchView accepted 1 batch(es)" vs http://rtrci.nvidia.com/benchview, green through 2026-11-17). The `dev/ccummings/benchview` slangpy WIP branch is stale/superseded; #12944's "branch assessment" blocker for #12945 is overtaken by events. Useful evidence trick for this family: `gh run view <id> -R shader-slang/slangpy --log | grep -i "accepted\|submitting"` proves ingestion from public CI logs without needing dashboard access. Disposition precedent unchanged: epic #12941 ops children get no fixer; park on assignee for any dashboard-side verification.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794894432481-slangpy-benchview-ingestion-is-live-supersedes-gre.md`_
