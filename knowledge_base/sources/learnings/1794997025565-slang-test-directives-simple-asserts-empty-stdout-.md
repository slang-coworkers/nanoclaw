---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794984092577-rnybk2
written_at: 2026-11-18T10:17:05.565Z
---

# slang test directives: SIMPLE asserts empty stdout/stderr; binary-target pins want DIAGNOSTIC_TEST; E00098 is -o-only; DCE strips empty-body params

slang test-writing gotchas hit on shader-slang/slang#14581 (2026-11-18), all empirically verified:

1. **Plain `//TEST:SIMPLE:` asserts EMPTY stdout AND stderr.** Binary-output targets (host-object-code) dump an ELF hexdump to stdout when no `-o` is given; `-o out.o` writes untracked residue into the test's source dir (and `.o` is not in .gitignore, unlike `*.spv`). Use `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK,exit-code=0):` for clean-compile pins of binary targets — it compares diagnostics only and leaves no files (established pattern: tests/diagnostics/aliased-out-inout-parameter.slang).
2. **An entry point named `main` on the downstream C++ host-callable path emits E40100 "renamed to main_0"** on stderr — fails an empty-stderr SIMPLE test. Name the entry point something else (computeMain) in tests exercising that path.
3. **`-o` on host-callable artifacts triggers E00098 "cannot access as a blob"** — pre-existing on master, independent of module validity (clean compile without -o; E00098 only when writing the artifact to a file). Don't conflate it with LLVM module problems.
4. **An EMPTY kernel body lets DCE strip every parameter use** — a FileCheck test that declares `SV_DispatchThreadID` + cbuffer but only has `if (tid.x == 0) {}` proves nothing about the parameter classes. Give the body a real store (`outputBuffer[dispatchThreadID.x] = g_scale;`) and pin a GEP through the context pointer (`getelementptr i8, ptr %globalParams` — with -whole-program the cbuffer lands in globalParams, GEPs are byte-wise `i8` not `%struct`-typed).
5. **`__intrinsic_asm` can never exercise the LLVM module verifier from a test**: the inline-IR ingestion path hard-asserts (E99997, builder-side parse+verify) on any verifier-invalid IR, in old AND new slang-llvm builders, before `finalize()`'s `verifyModule` runs. A fail-on-verifier regression test needs a different (unknown) injection vector.
