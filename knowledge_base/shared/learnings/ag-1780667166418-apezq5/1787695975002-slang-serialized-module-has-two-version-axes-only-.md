---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787695388319-lvfgqg
written_at: 2026-08-25T22:12:55.002Z
---

# Slang serialized module has TWO version axes — only the format one is checked on load (#12758)

Triaging shader-slang/slang#12758 (loading a too-new .slang-module crashes with 0xC0000005, no diagnostic). Two DISTINCT, easily-conflated version axes:

1. **Serialization/container FORMAT version** — `IRModuleInfo::serializationVersion` (currently 1, `IRModuleInfo::kSupportedSerializationVersion`). Governs the "fossil" payload encoding. IS checked on load: `readSerializedModuleIR_` returns SLANG_FAIL if it mismatches (`source/slang/slang-serialize-ir.cpp:813`).

2. **Semantic module version** — `IRModule::m_version` (range `k_minSupportedModuleVersion`..`k_maxSupportedModuleVersion` = 4..28, `slang-ir.h:2260-2261`, published by `-get-supported-module-versions`). Governs IR instruction-set *semantics*. **NOT checked on load** — read at `slang-serialize-ir.cpp:722`/`:782` but never range-compared. This is the gap that crashes.

Key gotcha: op-level incompatibility IS partially caught by the stable-name / `kIROp_Unrecognized` mechanism (SLANG_FAIL on unknown opcode) — but that only fires when the newer module actually *uses* a new op. A pure version bump with no new-op payload, or a semantics change on an existing op, slips straight through.

`-get-module-info` uses a SEPARATE lightweight reader `readSerializedModuleInfo` (`:761`) that reads only name/version/compilerVersion without deserializing the body — so it must (and does) keep working for incompatible modules. Any load-time version gate belongs in `readSerializedModuleIR_` (choke-point, no sink → SLANG_FAIL only) and/or the sink-bearing caller `Linkage::loadSerializedModuleContents` (`slang-session.cpp:~2238`) for a friendly diagnostic. Three full-load callers exist (slang-session.cpp:2238, slang-global-session.cpp:712, slang-serialize-container.cpp:680) — a choke-point check covers all three.

`m_version` is **private** with only friend serializer access (`slang-ir.h:2264`); a caller-side check needs a public getter. A defined-but-unemitted diagnostic `incompatible-riff-semantic-version` (code 90, `slang-diagnostics.lua:431`) is a template to model a new `unsupported-module-version` on.

REPRO GOTCHA: you cannot mint an out-of-range module with a single HEAD binary — new modules are always written at `k_maxSupportedModuleVersion`, so on HEAD (k_max=28) you can't naturally produce a >28 module. The repro needs two mismatched *release* binaries; a regression test likely needs a unit test byte-patching the serialized m_version, not a plain `.slang` file.
