---
title: "SUPERSEDES prior #11918 correction: the getRelativePath cross-volume EMPTY-dep IS the root cause (save produces, load consumes)"
type: learning
topic: verification
source: learnings/1783031868902-supersedes-prior-11918-correction-the-getrelativep.md
---

# SUPERSEDES prior #11918 correction: the getRelativePath cross-volume EMPTY-dep IS the root cause (save produces, load consumes)

Supersedes my earlier note "CORRECTION to #11918 learning: load-side path layer is drive-agnostic; getRelativePath is save-side only" — that note over-rotated and reached the WRONG conclusion. The reporter (skallweitNV) settled it with a Slang-public-API-only C++ repro + empirical inspection of the serialized module.

TRUE root cause of shader-slang/slang#11918 (cross-drive precompiled `.slang-module` cache miss, Windows), verified at HEAD 973274da9:
- `Path::getRelativePath` (source/core/slang-io.cpp:747-756, `std::filesystem::relative`) returns an EMPTY path across different Windows volumes/root-names.
- `encodeModuleDependencyPaths` (source/slang/slang-serialize-container.cpp:293-307) selects `linkageRoot` as the first search dir where `!hasRelativeElement(getRelativePath(searchDir, module))`. `hasRelativeElement("")` == FALSE (slang-io.cpp:456-469: empty string → empty split list → no `.`/`..`), so a CROSS-VOLUME search dir (the module-cache dir on the other drive, which IS on the search path) is spuriously accepted as linkageRoot.
- The module's own dependency is then encoded as `getRelativePath(linkageRoot, module)` (serialize-container.cpp:321-326) → cross-volume ⇒ EMPTY string, serialized with NO guard.
- On reload, `isBinaryModuleUpToDate` (slang-session.cpp:1810-1841) reads the empty dependency, `IncludeSystem::findFile` can't resolve an empty path → dep source "not found" → check returns false → recompile + cache rewrite = the miss.

So the load-side path-combine layer IS drive-agnostic *given a valid dep* — but the dep it receives is EMPTY, corrupted at SAVE. "Load layer is innocent" was the trap.

PROCESS LESSON (the durable takeaway): when a repro exists but you can't RUN it (here: needs Windows + two drives), a clean read of the CONSUMER can make you declare a layer innocent — but the corrupted INPUT to that consumer may be produced by a layer you dismissed. Trace producer→consumer END-TO-END, and treat "this helper is save-side only" as a reason to check what it writes into the artifact the consumer later reads, NOT as a reason to exonerate it. Also: a helper returning empty/degenerate output on an out-of-domain input (cross-volume relativize → "") that a downstream predicate then mis-classifies (`hasRelativeElement("")==false`) is a classic silent-corruption chain. Fix = producer-side: never serialize an empty/ambiguous dependency (fall back to absolute/canonical when relativization crosses roots; don't treat an empty relative path as "contained").

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1783031868902-supersedes-prior-11918-correction-the-getrelativep.md`_
