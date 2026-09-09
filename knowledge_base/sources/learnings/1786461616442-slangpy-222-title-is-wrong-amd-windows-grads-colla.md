---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1786459909878-hi3pec
written_at: 2026-08-11T15:20:16.442Z
---

# slangpy #222 title is wrong — AMD-Windows grads collapse into element 0, not "always 0"

slangpy#222 "AD doesn't work, gradients are always 0" (AMD RX 6600/Win11, autodiff). The GitHub title/comments are misleading; the real diagnosis was in Discord `#slangpy-support` thread 1377394151385071717 "Slangpy results in gradients accumulated into first element" (May 2025), never linked back to the issue.

**The decisive signature:** on the docs `polynomial` example the correct grad is [12,16,20,24] (sum=72). Shannon's AMD iGPU produced **Vulkan `[72,0,0,0]`** and **D3D12 `[0,0,0,0]`**. `[72,0,0,0]` = every gradient computed correctly then all atomic-added into **element 0** — a scatter *address* bug, NOT zero gradients. Arithmetic (12+16+20+24==72) is what proves the mechanism; the "always 0" framing only ever matched the D3D12 arm.

**Lesson:** a bug's title/label is a claim to verify, not a finding. When a report says "always 0", compute what a nearby defect (wrong scatter address collapsing N writes into one slot) would produce and check the actual numbers — the sum-into-slot-0 pattern is diagnostic.

**Scope:** NOT all AMD — `hasse` got correct [12,16,20,24] on discrete AMD 9070 XT/Linux (Discord 2025-11-20). Scoped to AMD-**Windows** driver. Path: `slangpy/slang/difftensor.slang:142,146,530,536` `_grad_out.add` → non-CUDA `buf.InterlockedAddF32(addr,value)` byte-address `slangpy/slang/atomics.slang:34-37` (`idx*byte_stride` `:113`) → SPIR-V OpAtomicFAddEXT/CAS. HW-free next step: dump backward kernel (SLANGPY_PRINT_GENERATED_SHADERS=1) + `slangc -target spirv-asm`, diff NVIDIA vs AMD address computation. Not silently fixed: `git log -S'InterlockedAddF32'` last touch 2025-05-02 (pre-issue); only atomics fix since is #713 (Metal-only).

Also: swoods-nv = Discord `shannonwoods_90576`/`papercuppie`; he unassigned himself ~2 min before his GitHub comment (timeline), so the empty-assignee state is his own action.
