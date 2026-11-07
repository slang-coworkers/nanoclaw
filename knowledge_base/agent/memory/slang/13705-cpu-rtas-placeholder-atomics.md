---
type: chain
title: slang#13705 — CPU targets: unused RTAS global fails the C++ compile (part 1); InterlockedAdd E36107 (part 2)
description: Human-filed (albertrodriguezclo) 2026-10-16. Part 1 = draft PR #13716 (CPU-prelude RTAS placeholder), review-complete, ready-flip pending. Part 2 (CPU atomics, D/E/F) parked on assignee jkwak-work; no bot timer.
tags: [cpu, cpp-emit, prelude, raytracing, atomics, capabilities, parked]
---

# slang#13705 — CPU RTAS placeholder + CPU `InterlockedAdd`

**Ask (10-16 14:28Z).** Two CPU-target problems in modules shared with SlangPy's CPU device:
(1) a declared but unused `RaytracingAccelerationStructure` global is emitted into the C++ globals struct, and the
C++ prelude has no such type; (2) `InterlockedAdd` (global and `RWByteAddressBuffer`) gives E36107 on cpp/host-callable.

**Part 1 — draft PR #13716** (`fix/issue-13705`, head `20b86c8bbc`, +105/−1, 4 files; fixer session `sess-1792161918784-yj8n7c`).
Pointer-sized `struct RaytracingAccelerationStructure { IRaytracingAccelerationStructure* handle; }` + `static_assert`
in `prelude/slang-cpp-types.h`, same shape as CUDA's #8411 and open PR #12282 (whichever lands second deletes one copy;
noted on #12282). Reviewer R1 APPROVE_WITH_NITS, all applied. Local: 7/7 new tests, 2737/2737 focused suites.
**No CI has run** (bot `workflow_dispatch` yields at the priority gate; the first "passed" run 38936988470 skipped
48/50 jobs, which I relayed as a pass and later corrected). PR body says "Addresses #13705 (part 1)".
11-06 22:57Z the reporter confirmed on #13716 that the fix is exactly their case and is fine with it landing here or folded into
#12282 (issuecomment-6697871133; fixer replied 6697925566, no code change). Cite this on the weekly list.
⇒ **Ready-flip pending** — goes on the weekly un-draft list, no per-PR ask
([../orchestrator/undraft-asks-replaced-by-weekly-list.md](../orchestrator/undraft-asks-replaced-by-weekly-list.md)).

**Part 2 — parked on jkwak-work.** Documented limitation (`docs/cpu-target.md`: user-code atomics unsupported on CPU).
Options: D real CPU `Interlocked*`, E clearer E36107, F docs only. The reporter prefers E now, D later (10-19 comment).
jkwak-work self-assigned 10-19 16:40Z (milestone Q4 2026). Related: #14183 / draft #14189 (`Atomic<T>` E99999→E55204;
does not touch `InterlockedAdd`). Triager's final re-check 11-06 found no maintainer direction; no more timers scheduled.

**Split ask.** The triager and the reporter both recommended splitting part 2 into its own issue. I asked the operator
10-16, 10-17 and 10-19 with no answer. Withdrawn 11-06: the assignee owns the issue now, so the split is theirs to make.
If the operator later approves it, relay to slang-triager on `gh-issue-shader-slang/slang-13705` (it files, links, and edits
comment 6276280880 in place).

**Live inbound.** A new human comment on #13705 goes to slang-triager (owner session `sess-1792160973464-rtb93l`) on
the canonical thread; on #13716 it routes via pr-mappings to the fixer.
