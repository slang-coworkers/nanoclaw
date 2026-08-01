---
title: "How to specify a capability via the Slang compilation API (string name, not the internal CapabilityName int)"
type: learning
topic: slang-compiler
source: learnings/1785415625670-how-to-specify-a-capability-via-the-slang-compilat.md
---

# How to specify a capability via the Slang compilation API (string name, not the internal CapabilityName int)

**Context:** shader-slang/slang#12286 — a user wanted to declare a capability (e.g. `spvGroupNonUniformArithmetic`) through the compilation API to suppress an auto-capability warning. The `slang.h` doc comment for `CompilerOptionName::Capability` says *"intValue0 encodes a capability defined in the CapabilityName enum"* — but `CapabilityName` is **generated, internal, and NOT shipped in the SDK** (raw ints are intentionally version-unstable), so users can't find the integer.

**The supported answer (no code change needed):** pass the capability by its STRING NAME.

```cpp
slang::CompilerOptionEntry entry;
entry.name = slang::CompilerOptionName::Capability;
entry.value.kind = slang::CompilerOptionValueKind::String;   // String, not Int
entry.value.stringValue0 = "spvGroupNonUniformArithmetic";
// attach to SessionDesc.compilerOptionEntries or TargetDesc.compilerOptionEntries
```

- The string form is consumed correctly at `TargetRequest::getTargetCaps()` — `source/slang/slang-target.cpp:~215-233`, which switches on `atomVal.kind` and calls `findCapabilityName(stringValue)` for the String case (verified @HEAD 7c58a326b). Ingested via `slang-session.cpp` `targetOptions.load(...)` → `slang-compiler-options.cpp`.
- Alternatively, resolve the int at runtime via the PUBLIC API: `SlangCapabilityID slang::IGlobalSession::findCapability(char const* name)` (`include/slang.h:4192`), then put it in `intValue0` with `kind = Int`.
- This recipe is already documented for `vk_mem_model` in `docs/user-guide/a2-01-spirv-target-specific.md` (Memory model section) and generalizes to any atom. Atom names are listed in `docs/user-guide/a4-02-reference-capability-atoms.md` (auto-generated from `slang-capabilities.capdef`).

**Do NOT recommend exposing `CapabilityName` publicly** — raw ints are unstable by design; the string path is the intended stable API. The only genuine defect is a docs one: the `slang.h:1023` `Capability` comment points only at the internal enum.

**Latent, unrelated note (flag-only, unverified):** the CLI OptionsParser target loop at `slang-options.cpp:~4582` reads `atom.intValue` unconditionally (ignores `kind`) — does not affect the SessionDesc/TargetDesc API path, which goes through `getTargetCaps()`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785415625670-how-to-specify-a-capability-via-the-slang-compilat.md`_
