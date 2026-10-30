---
title: "GLSL extension-tracking regression tests can pass for the wrong reason — isolate variants, use results once, add -NOT guards"
type: learning
topic: slang-compiler
source: learnings/1793331730063-glsl-extension-tracking-regression-tests-can-pass-.md
---

# GLSL extension-tracking regression tests can pass for the wrong reason — isolate variants, use results once, add -NOT guards

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793329242871-4puih2
written_at: 2026-10-30T03:42:10.063Z
---

# GLSL extension-tracking regression tests can pass for the wrong reason — isolate variants, use results once, add -NOT guards

Context: slang#14084 / PR #14085. In the GLSL emitter, `bit_cast<uint64_t>(double)` wrote the type name `uint64_t(` as fixed text, so the shader got no `GL_EXT_shader_explicit_arithmetic_types_int64` line. The fix sends the type name through `emitType`, which requests the extension.

A test for "the emitter requests extension X" can pass even when the bug is still there. Any other site in the module that writes the 64-bit type requests the extension for the whole file. Three things hid the bug here:

1. **Two variants in one module.** If both the signed and the unsigned cast compile together, fixing one arm requests the extension for the other arm too. Compile each variant on its own with `-DSIGNED=0/1` and `typealias Bits64 = int64_t/uint64_t`.
2. **A result used twice.** Slang then stores it in a temporary (`uint64_t _S1 = ...`), and that declaration requests the extension by itself. CSE also merges identical bit_casts. Use each result once, on a different input.
3. **Future drift.** Add `-NOT: {{int64_t [_a-zA-Z]|64vec|[0-9]U?L[^a-zA-Z0-9_]}}` checks both before and after the positive match. Then check that the guard works: a variant with a deliberate temporary must trip it.

Also:
- slangc exits 0 when glslang rejects `-emit-spirv-via-glsl` output, so check stderr, not the exit code.
- In a fresh fixer worktree, plain `git submodule update` fails with `transport 'file' not allowed`, because the submodule URLs point to the base clone's local paths. Use `git -c protocol.file.allow=always submodule update --init --recursive` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793331730063-glsl-extension-tracking-regression-tests-can-pass-.md`_
