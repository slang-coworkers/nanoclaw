---
title: "behind_by overlap gate: overlap on what your TEST OBSERVES counts, not just on your changed files"
type: learning
topic: agent-ops
source: learnings/1786029394195-behind-by-overlap-gate-overlap-on-what-your-test-o.md
---

# behind_by overlap gate: overlap on what your TEST OBSERVES counts, not just on your changed files

When a supervisor/CI nudge says *"green run, but BEHIND master — rebase?"*, the established gate is:
measure **file overlap** between the base's new commits and your changed files; zero overlap ⇒ the
existing green still binds and the rebase is a no-op (slang-rhi#812, 2026-08-06).

**That gate is necessary but not sufficient. Applied naively it gives the WRONG answer for an
emit-only / golden-output test.**

Counterexample, same day, shader-slang/slang#12155 (`fix/issue-8183`):
- My diff: 2 files — `source/slang/slang-ir-legalize-varying-params.cpp` + one `.slang` test.
- Master's 97 new commits: 1080 files. **Overlap with my 2 files: NONE.**
- Naive gate ⇒ "no overlap, don't rebase." **Wrong.**

Master had touched `slang-emit-wgsl.cpp`, `slang-emit-metal.cpp`, `slang-emit-c-like.cpp` and
`slang-ir-legalize-types.cpp`. My regression test is an **emit-only WGSL+Metal FileCheck** test — its
CHECK lines assert against the text those emitters produce. So the base's changes reach the exact
surface my test observes, even though they touch none of my files. A 19-day-old green did not bind.
(Re-verified after merging: repro 2/2, wgsl 58/58, metal 197/197 — it *happened* to still hold, but
that was a measurement, not something the file tally could have predicted.)

**Ask two questions, not one:**
1. Does the base touch *my files*? (conflict / semantic-drift risk)
2. Does the base touch anything *my tests read as output*? (emitters, preludes, golden/`.expected`
   files, capability tables, diagnostic text) — a FileCheck/COMPARE test is a contract with the
   producer, and the producer is not in your diff.

Also count the build-graph/workflow files (`CMakeLists.txt`, `.github/workflows/*`) as already noted —
they can invalidate a green with no source overlap at all.

**Generalizable form:** overlap is not "did the base edit my lines," it is "did the base edit anything
in the causal cone of the assertion I am relying on." Golden-output tests have a much wider cone than
their filename suggests.

Cheap probes:
```bash
MB=$(gh api repos/O/R/compare/master...<branch> --jq '.merge_base_commit.sha')
git diff --name-only $MB..origin/master | grep -E "slang-emit-|CMakeLists.txt|\.github/workflows/"
```
Use `git diff --name-only` locally for the base side — the `compare` API caps `.files` at 300, which
under-reports a 1080-file range (it reported `files_len:300` for `total_commits:97`).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786029394195-behind-by-overlap-gate-overlap-on-what-your-test-o.md`_
