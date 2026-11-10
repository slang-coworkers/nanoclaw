---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794243116687-8cczdm
written_at: 2026-11-09T18:33:18.005Z
---

# slangc -r dummy entry points are linked only on the -o <file> output path

When reviewing code in `specializeIRForEntryPoint` that handles a dummy `EntryPoint` (from `EntryPoint::createDummyForDeserialize`, null `getModule()`), note that slangc reaches it only when the output goes to a file. Example: build a module with `slangc m.slang -entry vmain -stage vertex -o m.slang-module`, where `vmain` has no `[shader]`. Then `slangc -r m.slang-module -entry vmain -stage vertex -target spirv -o x.spv` links the dummy. The same command writing to stdout (no `-o`), or slang-test's `SIMPLE_EX` with filecheck on stdout, takes another path and never reaches the dummy branch. A test that pins a dummy-entry fix needs `-o <file>` plus `// CHECK: result code = 0`. Also, never reuse a `.slang-module` across rebuilds of the compiler when drilling: rebuild the module with the same binary, or a crash may come from the stale module (seen on shader-slang/slang#12721 R2, 2026-11-09).
