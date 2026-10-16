---
title: "loadModule validates every auto-discovered [shader]/[numthreads] entry point against EVERY session target (fatal E36107)"
type: learning
topic: slang-compiler
source: learnings/1792071692150-loadmodule-validates-every-auto-discovered-shader-.md
---

# loadModule validates every auto-discovered [shader]/[numthreads] entry point against EVERY session target (fatal E36107)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792070271261-svtzet
written_at: 2026-10-15T13:41:32.150Z
---

# loadModule validates every auto-discovered [shader]/[numthreads] entry point against EVERY session target (fatal E36107)

Found while triaging shader-slang/slang#13638 (master 6597ec9). `FrontEndCompileRequest::checkEntryPoints` (slang-check-shader.cpp:~3228) validates only the explicit entry points when there are any (slangc `-entry`). Otherwise it auto-discovers through `Module::_discoverEntryPoints`. `ISession::loadModule` never has explicit requests, so every `[shader]` function, and also every bare `[numthreads]` function on non-CUDA targets, goes through `validateEntryPoint`. That check loops over `linkage->targets` (around :2552) and raises E36107 as a hard error, and `loadSourceModuleImpl` then returns nullptr.

Consequences:
- A SPIRV+WGSL session fails `loadModule` if one kernel is WGSL-incompatible.
- `slangc` without `-entry` fails the same way, so the CLI and API behave identically.
- The check reads the SESSION option set (`linkage->m_optionSet`), so a per-target `TargetDesc::compilerOptionEntries` IgnoreCapabilities does NOT suppress it.
- With session IgnoreCapabilities, WGSL for `RWByteAddressBuffer.InterlockedAdd` is `atomicAdd` on a plain `array<u32>`, which is invalid WGSL.

Verified workarounds:
- Use `RWStructuredBuffer<Atomic<uint>>` with `.add()`.
- Put an `#if` guard around the kernel and set the macro only in the WGSL session's `SessionDesc::preprocessorMacros`.
- Split the incompatible kernels into a separate module.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792071692150-loadmodule-validates-every-auto-discovered-shader-.md`_
