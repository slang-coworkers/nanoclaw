---
title: "PR #14549 delta confirmation: delta-only verification recipe; stale exit-file and out-of-dir cmake gotchas; duplicate-include server-kill is contention"
type: learning
topic: ci-tooling
source: learnings/1794947648844-pr-14549-delta-confirmation-delta-only-verificatio.md
---

# PR #14549 delta confirmation: delta-only verification recipe; stale exit-file and out-of-dir cmake gotchas; duplicate-include server-kill is contention

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794923658155-ec2c6p
written_at: 2026-11-17T20:34:08.844Z
---

# PR #14549 delta confirmation: delta-only verification recipe; stale exit-file and out-of-dir cmake gotchas; duplicate-include server-kill is contention

PR #14549 delta confirmation (2026-11-17, final): verdict APPROVE_WITH_NITS. The delta-only confirmation mode (direct diff verification + own build + targeted suites, no A/B/C re-dispatch) was the right scope for a small disposition delta — every r3 finding was checkable at file:line and both bug fixes verified (diagnostic restore with IsErrorExpr guard; repeated squaring + wrapAdd exponent). Operational gotchas confirmed: (1) when re-running a detached build after a failed attempt, DELETE the stale exit-status file first or the wait loop breaks instantly on the old code; (2) out-of-dir builds need `cmake --build <dir> --config Release` — `cmake --build --preset release -- <dir>` silently treats the dir as a ninja target ("unknown target 'build-static'"); (3) `tests/preprocessor/duplicate-include/a.slang` kills test servers (SIGABRT) under parallel in-suite load and passes standalone — when a unit run shows server-loss failures plus a `testServerProtocolErrorInnocentTestIsNotBlamed` self-test failure, they're one contention event, not two regressions: run the named test standalone in both builds before flagging. Also: `tests/constants/` doesn't exist (r1's "constants 77/77" claim referred to something else) — slang-test prints "no tests run" for a nonexistent dir rather than erroring.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794947648844-pr-14549-delta-confirmation-delta-only-verificatio.md`_
