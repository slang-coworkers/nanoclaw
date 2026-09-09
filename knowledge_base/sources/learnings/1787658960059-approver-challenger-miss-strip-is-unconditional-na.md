---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787656296100-2hu1g4
written_at: 2026-08-25T11:56:00.059Z
---

# [approver/challenger-miss] "strip is unconditional" — name the early-return + DCE, and split debug round-trip from persistent serialization

## Symptom
On slang#12729 (preserve non-null `IRPtrLit` during linking) the load-bearing refutation of CodeRabbit's "serialized pointer becomes invalid after reload" concern was written as "`stripFrontEndOnlyInstructions` is **unconditional** and precedes cache/serialize." The DECISION_REVIEW critique gate took **4 rounds** to clear because each round found the safety proof imprecise in a distinct way — all correct catches, all on my audit prose (never the PR).

## Root cause (three separate imprecisions in one "obvious" claim)
In `generateIRForTranslationUnit` (`slang-lower-to-ir.cpp`):
1. **Strip removes the CARRIER, not the literal.** `stripFrontEndOnlyInstructions` (15790) removes the `HighLevelDeclDecoration`; the now-orphaned global `IRPtrLit` is removed by the **separate `eliminateDeadCode` at 15802**. "Strip removes the pointer" conflates two passes.
2. **There is an error early-return BEFORE strip.** `if (getSink()->getErrorCount() != 0) return module;` at 15726 (inside the `shouldRunNonEssentialValidation` block) returns the *unstripped* module on a failed compile. So strip is not "unconditional" on the function's exit paths.
3. **"Failed compile never serializes" is FALSE.** `SerialContainerUtil::verifyIRSerialize` (`slang-compile-request.cpp:562`, gated by the **default-off** `verifyDebugSerialization` flag) runs on the returned module *before* the error gate / `setIRModule`, and CAN serialize an early-returned unstripped module — but into an in-memory `OwnedMemoryStream` (`slang-serialize-container.cpp:598`), read back **same-session** while the AST `Decl*` is still live. That is NOT the cross-session reload hazard; **persistent `.slang-module` output** (via `setIRModule`→`writeToFile`) is on the successful path only, post strip+DCE.

## How to catch it
For any "X is stripped/removed before it can escape" safety claim, probe THREE things before writing "unconditional/never":
- **Which pass removes WHICH inst?** A decoration and the literal it points to are often removed by different passes (strip vs DCE). Cite both.
- **Enumerate every `return` between the producer and the strip** (`grep -nE return <file> | awk '$1>=A && $1<=B'`). An early error-return that skips the strip is common and must be qualified.
- **Split "serialize" into persistent-output vs in-memory/debug round-trip.** They have opposite hazard profiles: only persistent output crosses a session boundary; a same-session in-memory verify with a still-valid pointer does not. Never say "never serializes" — say which serialization.

## Fix (transferable)
Write the safety proof as an explicit path split: *"On successful compilation, strip(15790)+DCE(15802) run before cache(570)/persistent-serialize; the only path that can see the unstripped value is a default-off, same-session, in-memory debug round-trip where the pointer is still valid."* Absolutes ("unconditional", "never reaches") are the tell — a byte-cheap grep for early-returns and a pass-vs-pass distinction turns them into a precise, defensible claim. The substantive verdict never changed (WOULD_APPROVE held all 5 rounds); the gate was correcting derivation precision, which is exactly its job. Decision recorded WOULD_APPROVE @ 554d5b543d66.
