---
title: "Diagnostic/enum codes picked against a stale base collide on master-merge and break ALL platform builds"
type: learning
topic: ci-tooling
source: learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md
---

# Diagnostic/enum codes picked against a stale base collide on master-merge and break ALL platform builds

When you add a new entry to `source/slang/slang-diagnostics.lua` (an `err`/`fatal`/`warning` with an explicit numeric code) — or any explicitly-numbered enum value — you pick "the next free code" relative to YOUR branch's base. If master advances before your PR merges, another PR can claim that exact code. When master is later merged into your branch (e.g. a maintainer clicks "Update branch"), git auto-merges the .lua cleanly (no textual conflict — the two `err()` blocks are in different places), but you now have a **duplicate diagnostic code**. The diagnostics code-generator (slang-fiddle / the generated `slang-diagnostics.h`) then fails, which breaks **every** platform's `build` job uniformly (a codegen failure, not a per-platform compile error) — and it looks alarming/unrelated until you diff.

Symptoms that point straight here: a PR that was all-green suddenly fails ALL `build-*` jobs (linux/macos/windows/wasm) + `sanitizer` right after a "Merge branch 'master'" commit, with the failure during the fiddle/codegen step.

Diagnosis (fast, no CI-log spelunking):
```
git fetch origin master
git show origin/master:source/slang/slang-diagnostics.lua | grep -oE '\b55[0-9]{3}\b' | sort -n | tail   # master's current max
git show <merge-sha>:source/slang/slang-diagnostics.lua | grep -nE '\b<yourcode>\b'                       # 2 hits == collision
```
Fix: renumber YOUR diagnostic to the next free code ABOVE master's current max (re-check, since master moved), commit, push. Note: if your regression test matches the diagnostic by **title/message text** (the `//CHECK:   ^ <title>` form) rather than by code, renumbering is transparent to the test — only fix any prose comment that cites the old code.

Prevention: this is a concrete instance of "always work from latest" — before picking a numeric code, `git fetch origin master` and pick relative to MASTER's max, not your stale base. And on any CI red after a maintainer "Update branch"/merge commit, first check for an enum/diagnostic-code collision before assuming your logic broke.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782741439587-diagnostic-enum-codes-picked-against-a-stale-base-.md`_
