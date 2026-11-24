---
title: "Fix-chain r2 lessons: fixes as new code, SlangInt width trap, Devin false-positive pattern"
type: learning
topic: slang-compiler
source: learnings/1795458497987-fix-chain-r2-lessons-fixes-as-new-code-slangint-wi.md
---

# Fix-chain r2 lessons: fixes as new code, SlangInt width trap, Devin false-positive pattern

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795450453198-jzc931
written_at: 2026-11-23T18:28:17.987Z
---

# Fix-chain r2 lessons: fixes as new code, SlangInt width trap, Devin false-positive pattern

From #14699 r2 (2026-11-23, conformance sequential-ID uniqueness, fix-chain round 2 of 2):

- **A round-1 fix can itself be the round-2 bug.** The r1 gap "out-of-range conformanceIdOverride silently wrapped" was fixed with `override > (SlangInt)0xFFFFFFFF` — but `SlangInt` is `int32_t` on `SLANG_PTR_IS_64=0` builds (wasm32), where that cast is -1 and every valid explicit ID gets rejected (feature disabled wholesale). A and Devin found it independently in r2; 64-bit CI and live x86_64 probes are blind to it. Rule: treat the fix delta as NEW code — re-derive platform-conditional algebra for any width/type-dependent check, especially ones touching `SlangInt`/`SlangUInt` (typedef swaps with SLANG_PTR_IS_64 in slang.h). Width-independent idiom: compare `(uint64_t)value > 0xFFFFFFFFull`.
- **Fix-chain test deltas inherit the bug class.** The new unit test's `4294967296LL + 5` rejection case narrows to 5 when passed to an int32_t parameter on 32-bit — the test would fail on the very platforms the fix re-enables, for the wrong reason. Guard above-2^32 assertions with `#if SLANG_PTR_IS_64`. Caught by codex OUTPUT_REVIEW, missed by all three reviewers.
- **Devin's "codegen failure for explicitly numbered generic conformances" is a recurring false positive** (flagged in both r1 and r2, refuted both times by live probes: generic type/interface → HLSL, generic → SPIR-V, all rc=0). Expect it on any PR touching slang-ir-lower-dynamic-dispatch-insts.cpp; probe before escalating.
- **Devin re-analysis lag hit r2 as predicted:** first fetch on a previously-analyzed PR returns the stale previous-head analysis ("behind the head commit"); one refetch ~10 min later got the fresh one. Check devin-commit-status.txt against the head before using devin-flags.md — this round the stale copy even lacked the fresh findings (the 32-bit bug).
- **COM always-write contract:** an early-error return that skips the tail `*out = result.detach()` is the odd path out — write nullptr before returning failure. Related record/replay mechanism (codex-verified plausible): PREPARE_POINTER_OUTPUT substitutes a temp only for null caller pointers, so RECORD_COM_OUTPUT dereferences a stale non-null slot — same fix.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795458497987-fix-chain-r2-lessons-fixes-as-new-code-slangint-wi.md`_
