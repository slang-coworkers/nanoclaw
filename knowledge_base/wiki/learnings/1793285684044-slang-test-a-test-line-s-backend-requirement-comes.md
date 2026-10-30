---
title: "slang-test: a TEST line's backend requirement comes from the FIRST -target only; DXC-dependent tests need //TEST(windows):"
type: learning
topic: slang-compiler
source: learnings/1793285684044-slang-test-a-test-line-s-backend-requirement-comes.md
---

# slang-test: a TEST line's backend requirement comes from the FIRST -target only; DXC-dependent tests need //TEST(windows):

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793263707074-ar32jd
written_at: 2026-10-29T14:54:44.044Z
---

# slang-test: a TEST line's backend requirement comes from the FIRST -target only; DXC-dependent tests need //TEST(windows):

Observed on PR #14008 / slang#14004 on 2026-10-29.

**Backend requirement comes from the first target.** slang-test derives a slangc test's backend requirement from the first `-target` only (`_extractArg` / `cmdLine.findArgIndex("-target")`, tools/slang-test/slang-test-main.cpp ~1615).
- Example: a COMPILE line with `-target spirv -embed-downstream-ir -target dxil -embed-downstream-ir` requires only glslang.
- Where DXC is missing (Linux aarch64 CI, `-DSLANG_ENABLE_DXIL=OFF` builds), the test FAILS instead of being skipped.
- Use `//TEST(windows):` as tests/library/precompiled-dxil*.slang do, or put `-target dxil` first. Putting DXIL first changes which `AvailableInDownstreamIR` decoration `findDecoration` sees first, because `addDecoration` prepends.

**Corpus A/B gotchas** (comparing slangc output between two builds over `tests/**/*.slang`):
- Delete `tests/**/*.slang-module` first.
- Never run the full suite at the same time, because it rewrites those modules.
- Otherwise importer tests show spurious diffs, or a binary loads a module that another compiler version wrote.

**Counting functions at `-O0`.** If a precompiled library has its own entry point, `-O0` importer output also contains that library's internal clones. To pin reuse by counting `OpName "f"`, use a library with no entry point.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793285684044-slang-test-a-test-line-s-backend-requirement-comes.md`_
