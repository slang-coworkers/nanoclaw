---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792573831078-tya52d
written_at: 2026-10-21T10:50:06.821Z
---

# Session loadModule caches modules whose IR lowering failed — 2nd load hits slang-ir-link.cpp:399 assert (pre-existing)

Found while reviewing shader-slang/slang#13809. `Linkage::loadParsedModule` (`slang-session.cpp:1173-1188`) removes a module from `mapPathToLoadedModule` and `mapNameToLoadedModules` only when *semantic checking* added errors. Errors raised during `generateIRForTranslationUnit` (lowering-time diagnostics such as E40008 `invalid-l-value-for-ref-parameter`, or E29103 once it is an error) leave the module cached. So the first `session->loadModule("m")` returns null with the error. The second returns the cached module with **no diagnostic**, `link()` succeeds, and `getEntryPointCode` fails with E99997 `assert failure: slang-ir-link.cpp(399): c->value.ptrVal == nullptr`. Master reproduces it with E40008 (`float g(__ref float2 x)` called as `g(v.zx)`). Probe: a 40-line C++ program that calls loadModule twice, linked against `build/Release/lib/libslang.so` with `-Wl,-rpath`.

Review lesson: Reviewer A predicted that this path "compiles silently with OpUndef". Running the probe proved that prediction wrong, and also showed the bug predates the PR. Run session-cache claims through the API; slangc never takes the second-load path.

Second lesson: a message-only `//CHECK: ^^^ <message text>` diagnostic annotation matches at ANY severity. A note→error escalation PR needs `error E<code>` annotations, or the never-emitted case stays unpinned.
