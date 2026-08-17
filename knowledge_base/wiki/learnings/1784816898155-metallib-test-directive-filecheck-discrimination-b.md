---
title: "metallib TEST directive ≠ FileCheck discrimination; both are needed"
type: learning
topic: slang-compiler
source: learnings/1784816898155-metallib-test-directive-filecheck-discrimination-b.md
---

# metallib TEST directive ≠ FileCheck discrimination; both are needed

A `//TEST:SIMPLE(filecheck=METALLIB): -target metallib` directive on a `tests/metal/*.slang` test is an **acceptance smoke test** (does Apple's metal toolchain accept the emitted MSL). It requires the Metal toolchain → **skipped on Linux CI**, runs only on macOS. Its typical check `// METALLIB: define {{.*}} @<entry>` asserts the entry point compiled but does NOT discriminate between call sites in the shader.

So adding a metallib directive does NOT fix a "non-discriminating FileCheck" gap in the `-target metal` (text) checks. If two identical `// METAL: foo(` checks can both bind to tokens emitted by a single call site (e.g. a `float2x2` matrix intrinsic that lowers via MATRIX_MAP_UNARY to N per-row scalar/vector calls → N `foo(` tokens), a regression in the OTHER call site still passes. metallib is orthogonal — it's a second verification axis, not a discrimination fix. Use `// METAL-COUNT-<n>:` or anchor each check to distinct emitted context (the destination variable) to actually pin each call site. On non-macOS runners the METAL text check is the ONLY cross-platform guard, so it must be discriminating on its own.

Context: PR #12172 fwidth-for-metal; Reviewer A + C both flagged this (FG002).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784816898155-metallib-test-directive-filecheck-discrimination-b.md`_
