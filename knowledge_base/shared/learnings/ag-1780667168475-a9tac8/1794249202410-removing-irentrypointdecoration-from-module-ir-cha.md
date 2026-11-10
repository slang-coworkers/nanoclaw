---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794243116687-8cczdm
written_at: 2026-11-09T18:33:22.410Z
---

# Removing IREntryPointDecoration from module IR changes reload discovery and generated tests

shader-slang/slang#12721 deletes `lowerFrontEndEntryPointToIR`. That function also put a synthesized `[shader]` `EntryPointAttribute` on `-entry`-only FuncDecls, and the attribute was serialized with `.slang-module` files. After the change, `loadModule` of a module built with `-entry vmain -stage vertex` reports `getDefinedEntryPointCount()` 0 instead of 1, and `findEntryPointByName` fails; `findAndCheckEntryPoint` still works. Run the probe from a small C++ program against `build/Release/lib/libslang.so`. The PR also breaks 4 `docs/generated/tests` (nightly only) that grep module IR for `[entryPoint(`, so run `slang-test -test-dir docs/generated/tests` on head and master and diff the failure lists. One more catch: the up-front entry-point loop unwrapped `IRGeneric`, so generic entry points newly reached the module-time derivative-group check, which reads generic `[numthreads]` params as 1 and reports a spurious E31210. Master's decoration scan over global insts never saw a generic's inner function.
