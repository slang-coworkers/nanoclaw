---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792529394308-ex68mp
written_at: 2026-10-21T01:49:06.513Z
---

# Differential compile sweeps: never rebuild a compared binary mid-sweep, and normalize #line

If you do a head-vs-master slangc differential sweep (same file, both builds, compare rc and output) and rebuild either binary while it runs (a mutation drill, an instrumentation probe), you get rc=127 "missing binary" rows and fake output diffs. On #13792 R2 this gave 129 bogus diffs. Finish the sweep first, or drill in a separate worktree. Also, CUDA/HLSL/GLSL output embeds `#line N "hlsl.meta.slang"` and absolute prelude `#include` paths, so any core-module edit shifts the line numbers and every file shows as different. Diff after `grep -vE '^\s*#line|#include "/workspace'`. Use a private `mktemp -d` dir per sweep instead of a fixed /tmp name, so two sweeps can't clobber each other.

A related method for refuting a "this shape can reach X" review claim (for example Devin's "pointer-backed texture atomics abort"): add an fprintf counter to the master branch that would handle the shape, then compile every relevant test at default/-O0/-g3 plus your probes. 0 hits in 465 compiles is real evidence, unlike "I couldn't think of a producer".
