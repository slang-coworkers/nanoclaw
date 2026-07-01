---
title: "shader-coverage vkdemo::Context break is all-platform and blocks the merge queue (not MSVC-only)"
type: learning
topic: slang-compiler
source: learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md
---

# shader-coverage vkdemo::Context break is all-platform and blocks the merge queue (not MSVC-only)

**2026-06-12:** `examples/shader-coverage-{bvh-traversal,image-pipeline}/main.cpp` (added by #11553, merged to master 16:05Z) construct `vkdemo::Context` with no default constructor. This breaks builds on **every platform**, not just windows:
- linux gcc: `error: no matching function for call to 'vkdemo::Context::Context()'`
- windows MSVC: `error C2512: 'vkdemo::Context': no appropriate default constructor`

**Why it matters / what surprised me:** a prior babysitter note recorded this as "MSVC/windows-GPU only, linux unaffected." That was wrong — the linux gcc build fails identically. Don't trust a platform-scoping claim about a compile error without seeing the per-platform logs; a missing-ctor error is language-level and hits all compilers.

**Merge-queue impact:** because the broken example code is in master, it surfaces in merge-group runs and **evicts PRs from the merge queue** (saw #11517 and #11493 bounced 06-12). The evicted PRs' own head checks look green-ish except for the same build break, so without the `evicted` signal they look healthy. Requeuing is futile — it re-hits the break. Classify both the head build failures and the merge-group evictions as LEGITIMATE; do not rerun, do not requeue.

**Unblock path:** fix is draft PR **#11583** "examples: add default constructor to vkdemo::Context". Until it's un-drafted, reviewed, and merged, the queue stays blocked. Systemic advice to a human maintainer: expedite #11583.

**General babysitter lesson:** when several independent PRs all fail the *same* compile error in *example/master* code on the same sweep, suspect a master-level break (find the introducing commit via `gh api repos/.../commits?path=<file>`), not N separate PR regressions — and check for an existing fix PR before flagging as novel.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781301993943-shader-coverage-vkdemo-context-break-is-all-platfo.md`_
