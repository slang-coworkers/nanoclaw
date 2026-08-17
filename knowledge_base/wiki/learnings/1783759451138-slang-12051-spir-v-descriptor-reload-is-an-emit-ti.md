---
title: "slang#12051 SPIR-V descriptor reload is an emit-time ARTIFACT not a spec requirement — proven by OpCopyObject pin (disassembled at HEAD)"
type: learning
topic: slang-compiler
source: learnings/1783759451138-slang-12051-spir-v-descriptor-reload-is-an-emit-ti.md
---

# slang#12051 SPIR-V descriptor reload is an emit-time ARTIFACT not a spec requirement — proven by OpCopyObject pin (disassembled at HEAD)

**Sharpens the earlier #12051 correction with disassembled SPIR-V.** For `DescriptorHandle<T>` sampled repeatedly after hoisting the handle→resource conversion into a local (`Texture2D tex = texH;`), verified at HEAD `4d91d47b` with real SPIR-V disassembly:

| Case | descriptor OpLoad in output | outcome |
|---|---|---|
| HLSL, hoisted local | `ResourceDescriptorHeap[i]` once, reused | loads once |
| SPIR-V, hoisted local | `OpLoad` **3×** from the SAME `OpAccessChain` | reloaded per use |
| SPIR-V, `pinDescriptor()` (`OpCopyObject`) | `OpLoad` **once**, reused by all 3 `OpImageSampleExplicitLod` | loads once |

SPIR-V hoisted disasm (abbreviated): `%24 = OpAccessChain ... %__slang_resource_heap %10` (pointer, computed once) then `%32 = OpLoad %19 %24` / `%43 = OpLoad %19 %24` / `%52 = OpLoad %19 %24` — three loads from the same pointer. pin() collapses to a single `%25 = OpLoad %19 %24`.

**Key conclusion (was the open design question):** the per-use reload is **NOT a hard SPIR-V requirement** — the pin variant proves a single `OpLoad` feeding N samples is valid SPIR-V. It's an **emit-time artifact**: on the SPIR-V path the loaded descriptor is treated as re-materializable, so the `OpLoad` is re-emitted at each use even when the user explicitly stored it into a dominating local. The user's local store is simply not honored on SPIR-V. `OpCopyObject` (the reporter's pin) defeats it by forcing a materialized SSA value the duplicator won't re-clone. HLSL naturally treats the resource value as storable, so the local is already respected there — that's the whole HLSL-vs-SPIR-V asymmetry. Related mechanism: `shouldDuplicateInstAtUseSite` unconditionally duplicates `CastDescriptorHandleToResource` at use sites (`slang-ir-util.cpp:2638`, "potentially produces non-storable types").

**Cleanest fix (surfaced to jkwak/csyonghe as leading option, their call):** make an explicitly-stored descriptor local "stick" on SPIR-V — don't re-materialize the load when the def dominates the uses. No new language surface; makes the reporter's plain hoisted snippet Just Work, matching HLSL. Alternatives: official `pin()`/`loadOnce()` builtin, or automatic loop-invariant-load hoisting.

**Tooling note (reusable):** `-target spirv-asm` needs the glslang disassembler downstream lib, which a bare Debug build here lacks (`failed to load slang-glslang`). Workaround that unblocked disassembly: put a RELEASE download's `libslang-glslang-*.so` on `LD_LIBRARY_PATH` alongside the Debug libs — `export LD_LIBRARY_PATH="$PWD/build/slang-<ver>-linux-x86_64/lib:$PWD/build/Debug/lib:$LD_LIBRARY_PATH"`. Then spirv-asm emits. Also: `-dump-ir` shows the load is a single shared inst in the final Slang IR (`getElement`/`SPIRVLoadDescriptorFromHeap` appears once); the duplication happens DOWNSTREAM at SPIR-V emit, so IR-dump counts alone under-report it — you must disassemble to see the true per-use OpLoad count.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783759451138-slang-12051-spir-v-descriptor-reload-is-an-emit-ti.md`_
