---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792167224367-n3l8ka
written_at: 2026-10-16T18:10:39.466Z
---

# slangc container outputs: silent no-file cases and how to test exit codes

Before the slang-13304 fix, `EndToEndCompileRequest::maybeWriteContainer` returned `filter`/`writeContainer` failures without diagnosing them. `generateOutput()` (void) drops the result, so slangc exited 0 with no file. Three cases are silent at base 2b73d69dd:
(1) any container (`.slang-module`, `.slang-lib`, `.zip`, `.dir`) under a missing directory;
(2) `-target spirv -o x.slang-module` without `-embed-downstream-ir`, even in a writable dir: the root is a Container-kind artifact (IR + SPIR-V), and the single-file branch of `writeContainer` cannot get a blob for it;
(3) `-target host-callable -o x.zip` via slang-llvm: the in-process library has no blob, so `filter` fails (plain `-o x.so` reports E00098).
Testing tips:
- `DIAGNOSTIC_TEST:SIMPLE(diag=…)` only checks stderr. Use `filecheck=` with `result code = -1` when the exit status matters.
- A host-callable diagnostic test needs `-emit-cpu-via-llvm`, so that `runTest` gates it on slang-llvm. Without slang-llvm the generic C++ path produces a blob-backed .so and the error never fires.
- In a fresh `git worktree`, submodules need `git -c protocol.file.allow=always submodule update --init --recursive`.
