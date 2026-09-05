---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788286504789-4b2zz1
written_at: 2026-09-04T17:23:32.503Z
---

# Handling aarch64-only compiler miscompiles from an x86_64-only coworker

When a Slang bug reproduces only on aarch64 (correct on x86_64) and the fixer's box is x86_64, several non-obvious moves paid off on shader-slang/slang#12871 (fwd_diff of user `IFloat` `neg()` → `0 0` on aarch64):

**Rule out the runtime layer with poison, not guesswork.** An env-gated frame-fill knob in the slangi VM (`SLANG_VM_FRAME_FILL` = baseline / 0xCC / 0x00) run against the repro, plus per-copy-site overlap instrumentation and a full bytecode disasm, proved the x86_64-emitted bytecode executes correctly regardless of frame garbage. That REFUTED the tempting "VM reads uninitialized working-set memory → zero-init fixes it" root cause and showed Approach A (zero-init) was inert. Don't ship a fix you've proven changes nothing.

**Whole-process valgrind (`--track-origins=yes`) sees what VM-only poison can't** — compile/emit-time C++ locals + libc. Here it pinned exactly one real uninitialized read (`PathInfo::type` unset on a synthesized host-VM "kernels" module), which is worth fixing as UB hygiene — but check whether it's SHORT-CIRCUITED (here `hasFoundPath() = (type∈…) && foundPath.getLength()>0`, foundPath empty on both arches ⇒ false regardless), which makes it benign-in-effect and NOT the symptom's cause. A valgrind hit is a candidate, not a confirmed root cause.

**The PR's own aarch64 CI legs are the verification oracle you lack locally.** Opening a DRAFT PR (Fixes-held) and reading the aarch64 leg is the honest way to get judgment on an unreproducible-locally symptom — not "shipping unproven."

**Restoring a KNOWN-RED test ENABLED makes the PR permanently unmergeable.** If triage asks to "restore a test that a prior PR removed to green CI," realize it was removed BECAUSE it's known-red on some arch. Keep the file but disable it (`//DISABLE_TEST:...`) with a tracking-issue comment — a discoverable breadcrumb, vs. the invisible gap that silent removal leaves.

**Skip qemu-user for emit-side / pointer-order arch bugs** — low-fidelity for -O2 UB and address-ordered container iteration, and heavy. The high-signal cheap move is a cross-arch emitted-bytecode dump-and-diff (via a minimal CI step or a maintainer with aarch64 hardware) to localize the divergent emission; then hand the interactive root-cause to someone with the hardware rather than spinning on an environment you can't reproduce in.

**Keyword hygiene:** if a "fix" turns out to be UB-hygiene that does NOT resolve the tracked symptom, downgrade `Fixes #N` → `Related to #N` before any merge so it doesn't auto-close the still-open issue.
