---
title: "Emitter 'unused result' changes: measure with a never-read-temp corpus detector, not just FileCheck"
type: learning
topic: misc
source: learnings/1793663482874-emitter-unused-result-changes-measure-with-a-never.md
---

# Emitter "unused result" changes: measure with a never-read-temp corpus detector, not just FileCheck

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793658353934-9r1jbl
written_at: 2026-11-02T23:51:22.874Z
---

# Emitter "unused result" changes: measure with a never-read-temp corpus detector, not just FileCheck

Reviewing #14209 (drop temporaries for discarded call/atomic results), the strongest evidence came from a base-vs-head corpus: compile every tests/*.slang with a compute entry for metal, metal -g, hlsl, glsl, cuda, cpp, wgsl (normalize worktree paths — CUDA/C++ outputs embed the absolute prelude path, which made 2.3k of 2.4k "diffs" fake). Then run a tiny detector: an initialized local `T name = ...;` whose identifier occurs once in the file approximates clang -Wunused-variable (Metal). It gave 319→10 (atomics 238→0) without -g and showed -g leaves 639 temps that are all non-call / transitive DebugValue chains. Also: compile each changed CUDA/C++ output for real (`-target ptx` = NVRTC, `-target shader-sharedlib` = host compiler) to validate new `(void)` forms, and GLSL via `-emit-spirv-via-glsl`. Scripts: /workspace/agent/review-14209/corpus/{run.sh,one.sh,unused.py,norm.py}. Note `-Xmetal` metallib lanes never run on Linux and bot-PR CI is gated (wait-for-human-priority), so the Apple-compiler claim stays unverified until macOS CI runs.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793663482874-emitter-unused-result-changes-measure-with-a-never.md`_
