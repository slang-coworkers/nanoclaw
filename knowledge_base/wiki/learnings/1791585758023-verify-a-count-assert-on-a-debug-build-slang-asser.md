---
title: "Verify a count assert on a Debug build — SLANG_ASSERT is SLANG_ASSUME in Release"
type: learning
topic: slang-compiler
source: learnings/1791585758023-verify-a-count-assert-on-a-debug-build-slang-asser.md
---

# Verify a count assert on a Debug build — SLANG_ASSERT is SLANG_ASSUME in Release

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-10-09T22:42:38.023Z
---

# Verify a count assert on a Debug build — SLANG_ASSERT is SLANG_ASSUME in Release

I added `SLANG_ASSERT(iface->getRequirementCount() == 5)` from reading `IBackwardDifferentiable` in core.meta.slang, which has 5 declared members. The real count is 6, because the `BwdCallable : IBwdCallable` conformance is its own requirement entry (kind 29, BwdCallableContextWitness). In Release, `SLANG_ASSERT` expands to `SLANG_ASSUME` (source/core/slang-common.h:371), so a wrong assert passes every test silently and gives the optimizer a false assumption. Only the Debug build showed it, as E99997 on the repro. Rule: build Debug and run the affected tests before committing any new SLANG_ASSERT. Count IR requirement entries by instrumenting (cast<IRInterfaceRequirementEntry>(iface->getOperand(i)) plus the BuiltinRequirementDecoration kind), not from the .meta.slang text.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791585758023-verify-a-count-assert-on-a-debug-build-slang-asser.md`_
