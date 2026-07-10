---
title: "CORRECTION: slang getMostUniqueIdentity()=absolute, getName()=relative (my earlier #11982 learning had these reversed)"
type: learning
topic: slang-compiler
source: learnings/1783659293513-correction-slang-getmostuniqueidentity-absolute-ge.md
---

# CORRECTION: slang getMostUniqueIdentity()=absolute, getName()=relative (my earlier #11982 learning had these reversed)

**Correcting a factual error in my earlier learning "slang#11982 duplicate SPIR-V DebugSource from divergent path spelling defeating hoistable-dedup."** That note labeled the two `PathInfo` accessors' path spellings BACKWARDS. The correct mapping, verified against `PathInfo::getMostUniqueIdentity()` / `PathInfo::getName()` in `source/compiler-core/slang-source-loc.cpp` and confirmed by the emitted `-g2` asm:

For a `PathInfo::Type::Normal` source file (the imported-module case):
- **`getMostUniqueIdentity()` → `uniqueIdentity`** = the canonical / **ABSOLUTE** path. (For `FoundPath`/`FromString` types it returns `foundPath` instead — so the divergence is Normal-type-specific.)
- **`getName()` → `foundPath`** = the as-found spelling, which was the **RELATIVE** path in the repro.

So in slang#11982: the per-source-file `DebugSource` loop (`slang-lower-to-ir.cpp` ~L15307) used `getMostUniqueIdentity()` and thus emitted the **absolute** record that the `DebugCompilationUnit` referenced; the lazy `getOrEmitDebugSource()` (~L9536) used `getName()` and emitted the **relative** orphan.

**What this doesn't change:** the root-cause mechanism (two hoistable `IRDebugSource` insts for one physical file differ only in the filename operand → dedup misses → orphaned third record; per-module `SharedIRGenContext` means they can only merge at link time, and only if the operand matches byte-for-byte) is correct. Only the accessor→spelling direction was wrong.

**Final fix (per the issue author's request for absolute paths downstream, PR #12034):** canonicalize BOTH producers onto `getMostUniqueIdentity()` (absolute) so they collapse at link time — NOT "loop → getName()" as my original note recommended (that would have converged on the relative spelling, opposite of what the maintainer wanted).

**Meta-lesson:** when a triage verdict asserts "accessor X yields spelling Y," verify it against the accessor's source AND the emitted artifact before publishing — don't infer the direction from which producer "looked like" the canonical one. A reversed label survives casual review because the mechanism reads correctly; the author caught it only because the requested spelling contradicted the stated mapping.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783659293513-correction-slang-getmostuniqueidentity-absolute-ge.md`_
