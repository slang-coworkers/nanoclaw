---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788888835038-x2uep1
written_at: 2026-09-08T22:20:06.649Z
---

# [approver/challenger-note] slang#12871 true root cause = signed-int cast UB in byte-code interpreter (aarch64 fcvtzu saturates) — confirms PathInfo UB was a red herring

**Confirmation of a prior correction.** An earlier note argued the uninitialized `PathInfo::type` read was NOT #12871's root cause (PR #12879 R1). PR #12879 R2 (head `560f01574a6c`, human-approved by jkwak-work) confirms it and names the real cause.

**True root cause.** The `slangi` byte-code interpreter's two `getCastHandler` dispatchers in `source/slang/slang-vm-inst-impl.cpp` mapped `kSlangByteCodeScalarTypeSignedInt` to **unsigned** C++ types (`uint8/16/32/64_t`) — a copy-paste from the adjacent unsigned case. `castHandler` does `dst = static_cast<To>(src)`, so a float→signed-int cast executed `static_cast<uint32_t>(-9.0f)`. Converting an out-of-range negative float to an unsigned type is **undefined behavior**, and the ISAs diverge exactly as UB permits: x86_64 lowers to `cvttss2si` (yields the correct two's-complement bit pattern, accidentally correct), while **aarch64 lowers to `fcvtzu`, which saturates negative inputs to 0** — hence the forward-mode autodiff `neg()` printing `0 0` instead of `-9 -6`. The same defect on the source-side dispatcher made signed→float read the operand as unsigned on every platform (e.g. `(float)(-9)` → ~4.29e9). Fix: route the signed case through `int8/16/32/64_t`, matching the sibling arithmetic/swizzle dispatchers (which were already correct). Fix lives at the single canonical scalar-type decode point; no consumer changes.

**Transferable signal for Step-0 recall.** An **aarch64-only** wrong *value* (especially a negative that comes back `0`, or a huge positive) under the `slangi`/`//TEST:INTERPRET` interpreter, correct on x86_64, is a strong tell for **signed-vs-unsigned handling in the VM's cast/arithmetic/swizzle dispatchers** — `static_cast<unsigned>(negative float)` UB where `fcvtzu` (aarch64) saturates to 0 while `cvttss2si` (x86_64) is accidentally correct. Probe those dispatchers before autodiff/emit. "Correct on x86_64, wrong on aarch64, deterministic" ⇒ suspect UB whose two lowerings legitimately differ, not nondeterminism.

**Test-quality note (positive exemplar).** #12879's regression tests defeat the "byte-identical no-op" trap the standing challenger warns about: `cast-signed-int.slang` routes operands through opaque helper functions so the interpreter really performs the casts at runtime (a folded `(int)(-9.0)` would print `-9` even on a broken build), covers both cast directions + a positive control, and the re-enabled autodiff repro flags its `(int)` casts as load-bearing. This is the shape to want when a fix's only observable difference is on a platform CI may or may not exercise.

**Decision context.** Both revisions abstained ABSTAIN_POLICY:`CLAUSE_FAIL:author_trust` (bot-authored fixer PR, CONTRIBUTOR, absent policy mount / v0-shadow) — a policy abstain excluded from agreement scoring, not a merits concern. The human approval on R2 is consistent with the clean merits read.
