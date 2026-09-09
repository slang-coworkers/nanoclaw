---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787643808263-ys5wpu
written_at: 2026-08-25T07:52:42.954Z
---

# Non-null IRPtrLit at linker = a HighLevelDecl escaping stripFrontEndOnlyInstructions

**Symptom:** `assert failure: slang-ir-link.cpp: c->value.ptrVal == nullptr` (a `SLANG_RELEASE_ASSERT`, so it fires in Release too) during per-target codegen. Seen in shader-slang/slang#12728 (structural ray-tracing, draft PR #12691).

**Root cause (verified on master@4be785081):** The IR linker's `kIROp_PtrLit` clone case in `IRSpecContext::maybeCloneValue` (`source/slang/slang-ir-link.cpp:389-395`) asserts every surviving `IRPtrLit` is null, because a raw front-end AST `Decl*` host pointer is meaningless in the fresh target link module. The only common producer of a *non-null* PtrLit is `IRBuilder::addHighLevelDeclDecoration` (`source/slang/slang-ir.cpp:7393-7397`), which wraps the `Decl*` via `getPtrValue`. That decoration (`kIROp_HighLevelDeclDecoration`) is unconditionally removed by `stripFrontEndOnlyInstructions` (`source/slang/slang-ir-strip.cpp:18`), stripping the PtrLit's only front-end use so DCE reclaims it.

**The ordering invariant to remember:** `stripFrontEndOnlyInstructions` runs ONLY during front-end module IR generation (`slang-lower-to-ir.cpp:15400/15790/16570`). It is **NOT** re-run inside `linkAndOptimizeIR`/`linkIR` (`slang-emit.cpp:1004`). Documented as phase D10 in `docs/generated/design/pipeline/04b-pre-link-passes.md:640-654`. Therefore **anything created after front-end lowering** (e.g. a *late-synthesized* entry point) that attaches a HighLevelDecl decoration will survive to the linker and trip the assert. Ordinary `findAndCheckEntryPoint` entry points go through the normal front-end lower+strip, so they don't reproduce it.

**Fix layer:** producer, not consumer. Either don't attach `HighLevelDecl` on late-synthesized module-scope insts, or re-run `stripFrontEndOnlyInstructions`(+DCE) after ALL late synthesis and before `linkAndOptimizeIR`. Do NOT relax the linker assert (masks the symptom; propagates a dangling host pointer into codegen). A defensive strip at the top of `linkIR` is belt-and-suspenders at best and hides the producer bug.

**Triage tip:** when you see this assert, grep the feature's late/synthesis path for `addHighLevelDeclDecoration` or any global-var/func/decl lowering that runs after the module was already stripped.
