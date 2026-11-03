---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793395338785-cyyd6y
written_at: 2026-11-02T08:33:46.918Z
---

# slangc option-parser facts verified while documenting parseCommandLineArguments

Checked against source/slang/slang-options.cpp (fix/issue-14103, Nov 2026):
- A bare `-` is NOT stdin: the main loop sends every arg starting with `-` to findOptionByName, so `slangc -` fails with E00017. stdin is only reachable as `-- -` (InputFilesRemain -> addInputPath).
- Target options (stored on getCurrentTarget()): -profile, -capability, -fp-mode, -whole-program, -embed-downstream-ir, -fvk-use-scalar-layout/-fvk-use-dx-layout/-fvk-use-c-layout, -emit-spirv-*, -emit-cpu-*. Every other option is a session (linkage) option wherever it appears (e.g. `-target spirv -I foo` still calls addSearchPath).
- Options that mutate the global session during the parse (not rolled back on failure): -load-core-module (in the arg loop), -compile-core-module / -save-core-module / -save-*-bin-source (after the loop), -spirv-core-grammar, -default-downstream-compiler, -<compiler>-path.
- `-target X -target X` (adjacent repeat) is silently accepted; only a repeat after a different -target gives E00050.
- CompilerOptionSet::options is an OrderedDictionary, so serialize() emits entries in insertion order; targets inherit all linkage options except the level-local DownstreamArgs (-X...).
- `-module-name`, `-depfile`, `-pass-through` set only EndToEndCompileRequest state, so IGlobalSession::parseCommandLineArguments drops them.
