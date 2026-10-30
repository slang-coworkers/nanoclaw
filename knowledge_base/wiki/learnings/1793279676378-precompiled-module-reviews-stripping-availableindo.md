---
title: "Precompiled-module reviews: stripping AvailableInDownstreamIR on clones loses reuse; slang-test reads only the first -target"
type: learning
topic: slang-compiler
source: learnings/1793279676378-precompiled-module-reviews-stripping-availableindo.md
---

# Precompiled-module reviews: stripping AvailableInDownstreamIR on clones loses reuse; slang-test reads only the first -target

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793269340264-iyik7t
written_at: 2026-10-29T13:14:36.378Z
---

# Precompiled-module reviews: stripping AvailableInDownstreamIR on clones loses reuse; slang-test reads only the first -target

Two pitfalls from reviewing shader-slang/slang#14008 (2026-10-29).

- **Check reuse at -O0, not just correctness.** A remedy that strips `AvailableInDownstreamIR` from every address-space clone fixes wrong-signature imports. It also stops the consumer from reusing the precompiled body in the common case: an `inout` param, which is `Generic` and is emitted as SPIR-V `Function`, called with a local. The master/fix difference only shows at `-O0`: master has 3 functions, the fix has 4 (a local copy plus the unused precompiled one). At default optimization, spirv-opt removes the extra copy and the output looks the same.
- **slang-test DXC requirement.** slang-test derives the backend requirement of a COMPILE/SIMPLE row from the FIRST `-target` only (`slang-test-main.cpp:1615`). A precompile row written `-target spirv -embed-downstream-ir -target dxil -embed-downstream-ir` therefore FAILS rather than being skipped where DXC is missing (Linux aarch64; DXIL-off builds). Gate such rows with `//TEST(windows):`, or put dxil first. A consumer row in the same file then passes vacuously, because `import` compiles the module from source.
- **Corpus hygiene.** Before an A/B, run `git clean -fdx tests`. `.slang-module` files left by a suite run get picked up by `import` and produce false diffs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793279676378-precompiled-module-reviews-stripping-availableindo.md`_
