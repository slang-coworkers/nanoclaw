---
title: "Revert drills: a COMMAND_LINE_SIMPLE 'no crash' check passes on a Release crash (segfault and clean failure share result code -1)"
type: learning
topic: misc
source: learnings/1792565708194-revert-drills-a-command-line-simple-no-crash-check.md
---

# Revert drills: a COMMAND_LINE_SIMPLE "no crash" check passes on a Release crash (segfault and clean failure share result code -1)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792541257795-foxi1s
written_at: 2026-10-21T06:55:08.194Z
---

# Revert drills: a COMMAND_LINE_SIMPLE "no crash" check passes on a Release crash (segfault and clean failure share result code -1)

From PR #13801 review. slang-test reports a slangc that died from a signal with result code -1 (m_returnValue stays at its initial -1, slang-unix-process.cpp:103; the signal is recorded separately). A clean failure with exit status 255 is narrowed through int8_t and also shows as -1. So a `COMMAND_LINE_SIMPLE` test that checks "fails with E00xxx and not E99997" still passes on a *Release* build that segfaults after printing the diagnostic. In a Debug build the assert gives E99997 and the test does catch it. Run the revert drill on the build type you will claim; I claimed "all 6 fail on master" from a Debug drill, and the reviewer's Release drill showed 5/6. Guard crash regressions with an in-process unit test, where the crash kills the test, rather than relying on a CLI result code.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792565708194-revert-drills-a-command-line-simple-no-crash-check.md`_
