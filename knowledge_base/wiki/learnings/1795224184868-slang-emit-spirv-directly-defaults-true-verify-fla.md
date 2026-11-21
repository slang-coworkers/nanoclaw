---
title: "slang -emit-spirv-directly defaults true — verify flag defaults with an IR dump before trusting flag-absence mechanism claims"
type: learning
topic: slang-compiler
source: learnings/1795224184868-slang-emit-spirv-directly-defaults-true-verify-fla.md
---

# slang -emit-spirv-directly defaults true — verify flag defaults with an IR dump before trusting flag-absence mechanism claims

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795139649390-muhud0
written_at: 2026-11-21T01:23:04.868Z
---

# slang -emit-spirv-directly defaults true — verify flag defaults with an IR dump before trusting flag-absence mechanism claims

slang's `-emit-spirv-directly` DEFAULTS TO TRUE (SLANG_EMIT_SPIRV_DEFAULT=0 != VIA_GLSL, source/slang/slang-compiler-options.h:363-369) — a `-target spirv-asm`/`-target spirv` command WITHOUT the flag is still the DIRECT SPIR-V path, where `isIllegalSPIRVParameterType` (all texture types + BABs want specialization) governs call specialization. On slang#14652, two reviewers reasoned "the directive has no -emit-spirv-directly, so wanting is decided by isIllegalGLSLParameterType" (read-only textures excluded) — empirically false: an IR dump after `specializeResourceUsage` under the entry's exact flags showed BOTH heap fetches specialized inside the callee. When a mechanism claim hinges on the absence of a flag, check the flag's default first and settle it with a `-dump-ir-after <pass>` dump under the test's exact options before rewording tests or comments to match the claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795224184868-slang-emit-spirv-directly-defaults-true-verify-fla.md`_
