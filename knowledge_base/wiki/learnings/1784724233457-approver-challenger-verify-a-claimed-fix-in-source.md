---
title: "[approver/challenger] Verify a claimed fix in SOURCE at the settled head — a fixer's later push can resolve a withhold, and a stale bot/Devin flag pointing at the fixed lines is refuted, not confirmed"
type: learning
topic: verification
source: learnings/1784724233457-approver-challenger-verify-a-claimed-fix-in-source.md
---

# [approver/challenger] Verify a claimed fix in SOURCE at the settled head — a fixer's later push can resolve a withhold, and a stale bot/Devin flag pointing at the fixed lines is refuted, not confirmed

**Symptom.** PR #12125 (shader-slang/slang, compile-perf memory tracking, jvepsalainen-nv) ran a 3-revision chain: R1 BLOCK (Windows include-order 🔴), R2 ABSTAIN_POLICY (two OPEN_GAPs — the include order/psapi.lib link, and an unreachable memory-trend alert). R3 was a later push that actually addressed them. The correct R3 call was WOULD_APPROVE — but only because I verified the fixes **in source at the settled head**, not from the review prose or the tool flags.

**Why source verification was decisive (and the tools were not).**
- The production PRIMARY review's R3 verdict flipped to 🟡 "Minor — no correctness issues" and simply DROPPED the two findings it had raised — but "the review stopped mentioning it" is weak evidence on its own. I confirmed each fix by reading the file at the pinned SHA: (1) `api-driver.cpp` now `#include <windows.h>` before `<psapi.h>` inside a `// clang-format off/on` block with a comment (the principled fix — it also guards the *tooling*, clang-format include-sorting, that would re-introduce the bug); (2) `trend.py`'s alert loop now guards on `judged()` (which includes kb-unit counters) instead of the old `timers_for` (which filtered `*Kb` out), with import-time `assert judged("minimal","peakRssKb")` self-checks pinning reachability.
- **Devin lagged and misread the fixed code.** Devin's R3 run flagged "trend kb floor unreachable" and "include order fragile" pointing at the exact lines that were now fixed. Same pattern as PR #11803 R4: a standing bot/tool flag whose target text is fixed/absent at the pinned head is **REFUTED, not confirmed**. The discriminator is always: read the source at the settled SHA. Source shows the fix present → the flag is stale → clear it. (Contrast R2, where the same "unreachable" flag WAS correct because the code still used `timers_for`.)

**The psapi.lib sub-finding — a toolchain non-defect the review over-flagged then dropped.** R2's primary review flagged "psapi.lib absent from the cl.exe link line." A C++ file calling `GetProcessMemoryInfo` compiled without `psapi.lib` is fine on any modern Windows SDK: with the default `PSAPI_VERSION=2`, `psapi.h` `#define`s `GetProcessMemoryInfo → K32GetProcessMemoryInfo`, exported from `kernel32.dll` and resolved via the auto-linked `kernel32.lib`. Explicit `psapi.lib` is only required under forced `PSAPI_VERSION=1` (pre-Win7 compat), which this code doesn't set. Don't withhold on a link-line "missing lib" for psapi functions unless `PSAPI_VERSION=1` is actually defined. (codex DECISION_REVIEW confirmed with the MSDN cite.)

**Calibration — CI-invisible out-of-band build still applies, but now cuts the other way.** `api-driver.cpp` is compiled out-of-band by `bench.py` via `cl.exe` (not in CMake), so green CI never proved the include order. That's why R1/R2 held. At R3 the fix was verified in source directly — the CI-blindness didn't matter because I read the code, and the fix (clang-format guard) is robust by construction.

**Transferable rule.** On any revision that claims to fix a prior withhold: (a) re-read the specific fixed lines in source at the settled SHA — never trust "the review no longer mentions it"; (b) treat any bot/Devin flag that points at the now-fixed lines as refuted (verify source-present vs source-absent, both directions); (c) prefer fixes that also guard the mechanism that introduced the bug (here, clang-format sorting) as evidence of a principled, durable fix; (d) a chain like BLOCK → ABSTAIN → WOULD_APPROVE is normal fixer convergence — decide each revision fresh, carry nothing forward.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784724233457-approver-challenger-verify-a-claimed-fix-in-source.md`_
