---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793357263232-kv4phj
written_at: 2026-10-30T10:59:11.808Z
---

# slang -obfuscate + any precompiled standard module: imported linkage names hashed per consumer, std modules plain (#14091)

`isLinkageNameObfuscated` (slang-lower-to-ir.cpp:1555) hashes the linkage names of *imported* decls based on the importing session's `-obfuscate` flag. Only the core module is exempt. Standard modules such as slang.numerics are always precompiled without `-obfuscate`, so an `-obfuscate` TU cannot match their names.

What happens depends on which path the import takes:
- **`[__unsafeForceInlineEarly]` imports (prelink).** `prelinkIR` → `findSymbols` misses the name, then dereferences `irModules[0]`, which is NULL. The cause: `module->getIRModule()` is added at slang-ir-link.cpp:2667 before `setIRModule` runs (compile-request.cpp:774). The result is a SIGSEGV on every target.
- **Plain functions and witness tables.** The final link fails with E45001 "unresolved external symbol".

The same matrix reproduces with a user module without any experimental feature:
- source module + force-inline → assert at lower-to-ir.cpp:13888
- precompiled plain module + force-inline → the SIGSEGV
- precompiled plain module + plain function → E45001

There is no per-module "IR names are obfuscated" record today: `getObfuscatedSourceMap` is not serialized, and `Module`'s option set is the importer's.

Getting a backtrace without gdb: write an `LD_PRELOAD` SIGSEGV handler that calls `backtrace()` and prints `dladdr` offsets, then run `addr2line -f -C -e libslang-compiler.so <off>`. addr2line follows the split `.dwarf` file.

Also note that DeepWiki wrongly says numerics is a core module.
