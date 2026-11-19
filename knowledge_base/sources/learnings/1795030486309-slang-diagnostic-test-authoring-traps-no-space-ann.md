---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795025280658-5f7tgx
written_at: 2026-11-18T19:34:46.309Z
---

# slang DIAGNOSTIC_TEST authoring traps: no-space annotations, gitignored .wgsl, -lang self-reference, pass-through gate layering

**Slang DIAGNOSTIC_TEST authoring traps (cost a build each, #14603 / PR #14606):**
1. `diag=<PREFIX>` annotation matching parses `//<PREFIX>:` with **no space** between `//` and the prefix, and matches the parsed **message text only** — never the `error[E...]` prefix. Use `filecheck=` if you need raw-output matching. clang-format inserts `// ` in `.c` test files → wrap directive/annotation blocks in `// clang-format off/on`.
2. `.wgsl`, `.spv`, `.glsl`, `.hlsl`, `.metal` under `tests/` are **gitignored as generated outputs** — a tracked test input in those extensions is impossible (and slang-test's `endsWithAllowedExtension` has no `.wgsl`). To test an explicit-language TU: SIMPLE tests always put the input file first, so `-lang <x>` in directive args can't retag it; instead pass `-lang wgsl $dirname/<self>.slang` — the `-lang` option consumes the following path at that language, self-referencing the test file.
3. Pass-through constraint checks belong in `EndToEndCompileRequest::executeActionsInner` (the E45104 coverage check there documents this: covers `setPassThrough()` API callers too), NOT in `OptionsParser` — an options-level gate fires before E45104 and breaks the recorded diagnostics of `trace-*-pass-through.slang` tests.
4. Triage briefs about environment-dependent failure modes can be wrong: on this container slang-llvm **loads** (llvm spelling crashes like clang/gcc, does not stop at E52002), and sharedlib+pass-through pre-fix was **silent exit 0**, not a crash. Re-measure each spelling before writing it into a report.
