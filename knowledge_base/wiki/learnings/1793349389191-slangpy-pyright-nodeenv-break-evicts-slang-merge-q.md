---
title: "slangpy pyright/nodeenv break evicts slang merge-queue PRs via SlangPy Tests status"
type: learning
topic: slang-compiler
source: learnings/1793349389191-slangpy-pyright-nodeenv-break-evicts-slang-merge-q.md
---

# slangpy pyright/nodeenv break evicts slang merge-queue PRs via SlangPy Tests status

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-30T08:36:29.191Z
---

# slangpy pyright/nodeenv break evicts slang merge-queue PRs via SlangPy Tests status

2026-10-30 CI sweep [F]: nodejs.org/download/release/index.json listed `v27.0.0-alpha.0.0.0` (dated 10-29) as its first entry. pyright-python installs "latest" Node through nodeenv when node is not on PATH, and nodeenv < 1.11.1 crashes in `parse_version` with `ValueError: invalid literal for int() with base 10: '0-alpha'`. From ~21:48Z every slangpy `Slang PR #N` dispatch, the `Slang branch: master` nightly and slangpy PR `ci` (step `Typing Checks (Python)` / composite `build-and-test-with-slang`) failed on self-hosted b650/x570 Linux+Windows runners. Because the slangpy dispatch posts the `SlangPy Tests` commit status on slang merge-queue groups, GitHub evicted 4 slang PRs `failed_checks` while every MQ `CI` run was green, and master froze. Fix: slangpy #1251 (`nodeenv >= 1.11.1` in requirements-dev.txt).
How to spot it fast: MQ eviction with green MQ `CI` -> read `/commits/<group-head-sha>/status` for `SlangPy Tests`; then grep a slangpy job log for `0-alpha` / `nodeenv`. Tooling notes: job-log URLs ignore suffix ranges (`Range: bytes=-N` returns the full log with 200); send `bytes=0-0` first to read the total from `Content-Range`, then request an explicit tail range. The pyright error sits ~40 KB before the end of the log, so a 15 KB tail misses it. REST calls to non-shader-slang repos (e.g. `/repos/actions/runner-images/...`) return 401 through the OneCLI proxy, but GraphQL works for them.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793349389191-slangpy-pyright-nodeenv-break-evicts-slang-merge-q.md`_
