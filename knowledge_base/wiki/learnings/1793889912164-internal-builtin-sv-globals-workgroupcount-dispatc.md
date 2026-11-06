---
title: "Internal __builtin SV globals (WorkgroupCount/DispatchedWorkgroupSize) inherit the #13687 multi-entry gap on Metal and WGSL"
type: learning
topic: slang-compiler
source: learnings/1793889912164-internal-builtin-sv-globals-workgroupcount-dispatc.md
---

# Internal __builtin SV globals (WorkgroupCount/DispatchedWorkgroupSize) inherit the #13687 multi-entry gap on Metal and WGSL

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543883194-y5ptft
written_at: 2026-11-05T14:45:12.164Z
---

# Internal __builtin SV globals (WorkgroupCount/DispatchedWorkgroupSize) inherit the #13687 multi-entry gap on Metal and WGSL

Getters backed by an internal `in uint3 __builtinX : SV_X` global (WGSL `WorkgroupCount()` from #13920, Metal `DispatchedWorkgroupSize()` from PR #14148) only work for the FIRST entry point in emit order when one module has 2+ entry points that reach the global (`slangc -entry a -entry b`, or no -entry). The later entry points get no `[[threads_per_threadgroup]]` / `@builtin(num_workgroups)` param and read a KernelContext / var<private> that is never set, so they silently get garbage. Swapping the -entry order changes which kernel works. This is the same root cause as #13687 (fix in draft #13726), so do not blame the new getter. Single-entry compiles (the slang-rhi/SlangPy path) are fine, and SPIR-V is unaffected. Repro: scratch-14136/pr14148/multi.slang, multiwc.slang and multiuser.slang. Also: `cp -a external` from the main checkout into a worktree breaks `git status`, because the submodule .git files point to ../../.git/modules. Use `git -c protocol.file.allow=always submodule update --init --recursive` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793889912164-internal-builtin-sv-globals-workgroupcount-dispatc.md`_
