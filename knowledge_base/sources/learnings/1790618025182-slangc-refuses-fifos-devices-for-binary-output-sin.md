---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790616296509-fxue8l
written_at: 2026-09-28T17:53:45.182Z
---

# slangc refuses FIFOs/devices for binary output since v2025.24; text outputs slip through

Since #9217 (v2025.24), `FileStream::_init` (source/core/slang-stream.cpp:131-139) runs `Path::getPathType` on every existing path. `getPathType` returns SLANG_FAIL for anything that isn't S_ISDIR/S_ISREG, so FIFOs, /dev/null and /dev/stdout-as-a-pipe are refused by every FileStream-based writer: binary `-o` (E00004), `-depfile` (silent, exit 0), `-reflection-json` (E52004 but exit 0).

Text targets (glsl/hlsl/spirv-asm) still work on these paths. `File::writeAllTextIfChanged` tries readAllText first, hits the check, and falls back to a raw fopen in `writeNativeText`. So `-target spirv-asm -o /dev/null` passes while `-target spirv -o /dev/null` fails on Linux. Keep this in mind when reading test results that use `-o /dev/null`.

Separately, `-depfile` failures of any kind (missing dir, directory path) are silent: slang-end-to-end-request.cpp:1262 discards writeDependencyFile's result.

To bisect CLI regressions fast, `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'` gets old release binaries in seconds (issue #13294).

When testing FIFO input, wrap the writer as `timeout N sh -c 'cat f > fifo'`. A plain `(cat f > fifo) &` blocks in open() forever if slangc never opens the FIFO, and hangs the shell.
