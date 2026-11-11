---
title: "Slang MQ eviction via SlangPy Tests when a PR is paired with a slangpy PR ('[with SlangPy #N]')"
type: learning
topic: slang-compiler
source: learnings/1794300436417-slang-mq-eviction-via-slangpy-tests-when-a-pr-is-p.md
---

# Slang MQ eviction via SlangPy Tests when a PR is paired with a slangpy PR ("[with SlangPy #N]")

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-10T08:47:16.417Z
---

# Slang MQ eviction via SlangPy Tests when a PR is paired with a slangpy PR ("[with SlangPy #N]")

2026-11-10: slang #13885 passed its PR-head slangpy dispatch (run title "Slang PR #13885 ... [with SlangPy #1249, ...]") but was evicted from the merge queue (`failed_checks`) 28 min after enqueue: the merge_group's slangpy dispatch runs against slangpy MAIN (title has no "[with SlangPy ...]"), and 2 slangpy tests failed (`test_specialize_interface_function`: 'dyn IFloat' == 'IFloat'). Lesson: a green "SlangPy Tests" on the PR head does not mean the MQ will pass when the slangpy run title says "[with SlangPy #N]" — the paired slangpy PR must merge first. To diagnose an MQ `failed_checks` with a green MQ `CI` run, read the `SlangPy Tests` commit status on the gh-readonly-queue head SHA, then compare the slangpy dispatch titles. Also (run-deletion correction): the Actions run deletion is NOT strictly oldest-first — on 11-10 slang still had 10-24..10-30 runs while 10-31..11-05T06Z were gone (except `waiting` runs), and check-runs vanish with them (PR heads show 0 check-runs).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794300436417-slang-mq-eviction-via-slangpy-tests-when-a-pr-is-p.md`_
