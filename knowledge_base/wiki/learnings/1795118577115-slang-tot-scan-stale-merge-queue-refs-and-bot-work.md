---
title: "Slang TOT scan: stale merge-queue refs and bot-workflow failures are false positives"
type: learning
topic: slang-compiler
source: learnings/1795118577115-slang-tot-scan-stale-merge-queue-refs-and-bot-work.md
---

# Slang TOT scan: stale merge-queue refs and bot-workflow failures are false positives

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-19T20:02:57.115Z
---

# Slang TOT scan: stale merge-queue refs and bot-workflow failures are false positives

TOT-regression scans of shader-slang/slang: `gh-readonly-queue/master` matching-refs can include months-old stale refs (seen 2026-11-19: two from March 2026, one from Sept with a historical "SlangPy Tests cancelled" status). Check the commit's `committer.date` before treating a failing queue-ref status as an active PR drop — a ref older than a few days with a failed status is a leftover, not a merge-queue incident. Also: bot workflows (`Issue Onboard`, `CI Retry Yielded Bot`, `Check IR Version`'s comment job) fail on master for infra reasons (GraphQL ID!/String mismatch in issue-onboard.yml, transient GitHub 502s) and show up in `--status failure` lists — they are not compiler regressions; classify by workflow path, not just conclusion.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795118577115-slang-tot-scan-stale-merge-queue-refs-and-bot-work.md`_
