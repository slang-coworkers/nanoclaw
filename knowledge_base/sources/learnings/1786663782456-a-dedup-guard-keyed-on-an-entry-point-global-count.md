---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786656362487-apqyu5
written_at: 2026-08-13T23:29:42.456Z
---

# A dedup guard keyed on an entry-point-global counter drops a second, distinct object's work

**Context:** Fixing slang#12532 (CUDA/OptiX `inout` ray payload read from registers twice — 8 gets/4 sets — because the direction-agnostic `RayPayload` legalization branch ran `emitOptiXPayloadRead` on both the `VaryingInput` and `VaryingOutput` passes). File: `source/slang/slang-ir-legalize-varying-params.cpp`.

**The trap:** My first fix skipped the redundant output-pass readback when `m_payloadWritebacks.getCount() != 0` — i.e. "has ANY register write-back been registered on this entry point?". That reads correct for the single-payload case that the repro and every existing `tests/optix/optix-payload-*` test exercised. But `m_payloadWritebacks` is **entry-point-global**, and a single `closesthit`/`miss` can legally carry two payloads (see `tests/vkray/multipleinout.slang`). For `inout Small` (register path) + large `inout/out Big` (pointer-packing fallback), `Big`'s output pass saw a non-zero count *from `Small`'s* write-back and returned an empty value — **silently dropping `Big`'s outgoing store** (`getOptiXRayPayloadPtr` count went 1→0 vs the base compiler). The fix: key the skip on the specific object — `hasRegisteredPayloadWriteback(info.type)` — so a different payload falls through to its own assignment.

**The general rule:** When you add a guard/dedup/skip whose predicate is "has X already happened?", check the **scope** of the state you're testing. If the state accumulates across *multiple distinct objects* (params, entries, files) but your intent is *per-object*, a global count/flag will fire for the wrong object and drop its work. Key the predicate on the object identity (type, name, pointer), not a bare count.

**How it was caught — the process lesson:** an ad-hoc reasoning pass ("pure-out and pointer-packing are unaffected") *asserted* safety and was wrong. The codex critique flagged it High; I then **built the adversarial two-payload case and compiled it against BOTH the pre-fix base binary and my fixed binary**, comparing emit. The base emitted `*((Big_0*)getOptiXRayPayloadPtr()) = ...`; my buggy fix didn't. That empirical base-vs-fix diff is what turned "plausible concern" into "confirmed bug" — and later proved the corrected fix drops no write in any permutation (same-type, different-type, reg+ptr, reg+small-out). **For any compiler codegen change: verify against a pre-change binary across a permutation matrix, don't reason about the emit.**

**Secondary:** on an edge without FileCheck, `slang-test` marks `//TEST:SIMPLE(filecheck=...)` tests `ignored` (0 passed/0 failed) — indistinguishable from "passed" at a glance. Verify codegen-shape fixes by direct `slangc -target cuda` emit + `grep -c`, and say "FileCheck absent → CI must validate directives" in the report rather than implying local pass.
