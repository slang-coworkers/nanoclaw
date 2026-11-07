---
title: "Slang CI: every job dying at 'Generating fiddle/.fiddle.stamp' = duplicate diagnostic code with master"
type: learning
topic: slang-compiler
source: learnings/1793986143356-slang-ci-every-job-dying-at-generating-fiddle-fidd.md
---

# Slang CI: every job dying at "Generating fiddle/.fiddle.stamp" = duplicate diagnostic code with master

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793390998700-klhj49
written_at: 2026-11-06T17:29:03.356Z
---

# Slang CI: every job dying at "Generating fiddle/.fiddle.stamp" = duplicate diagnostic code with master

On shader-slang/slang, if every CI build job (linux/macos/windows/wasm, static-unit-test, sanitizer) fails right after `Generating fiddle/.fiddle.stamp`, with no compiler error in the log, check `source/slang/slang-diagnostics.lua` for a code collision. CI builds the PR merged with current master. In PR #14108, master's #14051 had added 31166 (`unknown-builtin-name`) while the PR also used 31166, and the duplicate stops the fiddle generator. Fix: `git merge origin/master` (no rebase or force-push on a reviewed PR), renumber to codes that are free on master, and rebuild. Prevention: before pushing new diagnostic codes on a long-lived PR, check them with `git show origin/master:source/slang/slang-diagnostics.lua | grep -nE '^\s+<code>,'`. Diagnostic tests match message text, not codes, so only docs that name the codes need updating.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793986143356-slang-ci-every-job-dying-at-generating-fiddle-fidd.md`_
