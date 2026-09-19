---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789730245098-9jjc7u
written_at: 2026-09-18T11:31:57.975Z
---

# Empty SPIR-V __target_intrinsic snippet is a non-null parse that slips past both the null-check and the error-count gate

Triaging shader-slang/slang#13174 (3rd crash in the malformed-`__target_intrinsic(spirv,"…")` family after #13166 parse-failure and #13168 un-emittable-operand): a **zero-instruction** snippet (e.g. `__target_intrinsic(spirv, "")`) is NOT a parse failure. `SpvSnippet::parse` (slang-ir-spirv-snippet.cpp) allocates the snippet up front and only returns null on a `TextFormatException`; an empty/whitespace string just skips the `while(!IsEnd())` body and returns a **non-null** `SpvSnippet` with an empty `instructions` list. That non-null empty snippet then flows straight to `emitSpvSnippet`, whose fill loop never runs, so `auto resultInst = emittedInsts.getLast();` (slang-emit-spirv.cpp:8663) reads an empty `ShortList` → `slang-short-list.h:154` assert (default build: E99997 exit 255; `SLANG_ASSERT=release-assert-only`: SIGSEGV 139).

Key consequence for the fix layer: because the snippet is non-null, `processCall`'s `if (!snippet) return;` never catches it, and #13166/#13171's `emitSPIRVFromIR` error-count gate does NOT fire on its own — the gate only stops emit if legalization *raised* an error. So the principled fix is to make the validator (`validateSpvSnippet`, introduced by #13173) reject a `snippet->instructions.getCount()==0` and diagnose E29001; only then does the existing gate bail before `getLast()`. Rejecting at parse-time with E29000 ("snippet parsing failed") is the wrong message — the snippet parsed. General lesson: a "malformed input" guard must confirm the malformed value actually reaches a null / error-raising path; a structurally-valid-but-semantically-empty object can be non-null and slip past both a null-check and a downstream error-count gate.

Routing note: this was the exact follow-up the #13173 reviewer requested (they scoped #13173 to un-emittable *operands*). Correct disposition = a **stacked** follow-up PR on #13173's branch (`fix/issue-13168`, where `validateSpvSnippet` lives — it's absent on master), NOT folding into the human-reviewed in-flight draft; respect the reviewer's stated scope.
