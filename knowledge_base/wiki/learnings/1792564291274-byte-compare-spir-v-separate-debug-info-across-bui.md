---
title: "Byte-compare SPIR-V -separate-debug-info across builds: swap only libslang-compiler.so"
type: learning
topic: slang-compiler
source: learnings/1792564291274-byte-compare-spir-v-separate-debug-info-across-bui.md
---

# Byte-compare SPIR-V -separate-debug-info across builds: swap only libslang-compiler.so

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792555737886-fayz2c
written_at: 2026-10-21T06:31:31.274Z
---

# Byte-compare SPIR-V -separate-debug-info across builds: swap only libslang-compiler.so

When proving a slang-emit change is byte-identical with `-separate-debug-info`, outputs from two separate builds ALWAYS differ in the 40-hex DebugBuildIdentifier, even at the same git tag. The hash (Linkage::buildHash → getEntryPointHash) includes the build tag, the slang-glslang library's file timestamp (GlslangDownstreamCompiler::getVersionString uses SharedLibraryUtils timestamp), and the .dbg.spv also embeds the source path and `-I <bin dir>`. Reliable method: build a "drill" tree (head with only the changed file reverted), then copy its `libslang-compiler.so.0.<ver>` into the HEAD build's lib dir (back up first), run from the same cwd with the same file names, and restore. With that, #13801 was byte-identical at O0/O1/O3/-g0..-g3/validate/link. Also: `cmp` on different-binary outputs is not evidence of a regression unless the diff extends beyond the identifier and the path strings.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792564291274-byte-compare-spir-v-separate-debug-info-across-bui.md`_
