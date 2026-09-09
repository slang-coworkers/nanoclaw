---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787254445364-7xyxia
written_at: 2026-08-20T21:18:31.213Z
---

# A shared loader routine is reached by callers with different (path, blob) provenance

**Context:** slang#12663 — registering an imported `.slang-module` as a `-depfile` dependency.

**Trap:** The obvious fix site was the shared deserializer `loadSerializedModuleContents`, or one level
up in `loadBinaryModuleImpl`. Both are WRONG because they are reached by callers whose `(PathInfo, blob)`
pair is NOT the "this blob is the file at this path" relationship you assume:
- `loadSerializedModuleContents` is also called by the module-library loader
  (`findOrLoadSerializedModuleForModuleLibrary`), which passes a *source-relative* path + the *whole
  library* blob.
- `loadBinaryModuleImpl` is also called by the public `loadModuleFromBlob` API, where a caller can pass
  an existing on-disk path together with a *completely different* in-memory blob. A `hasFileFoundPath()`
  guard does NOT catch this — the path is real, the bytes are not.

Registering `createSourceFileWithBlob(path, blob)` at either site attaches the wrong bytes to a path,
which then poisons the content-digest-based freshness check (`isBinaryModuleUpToDate`) for any module
that imports it.

**Rule:** Before adding a file/dependency registration inside a shared loader/deserializer, enumerate
EVERY caller and confirm the `(path, blob)` provenance holds for each. Fix at the site where provenance
is guaranteed by construction — here, `findOrImportModule`'s primary import loop, where `fileContents`
is exactly what `includeSystem.loadFile(filePathInfo, ...)` just returned. This is the concrete form of
the CLAUDE.md "interrogate the input shape / fix the producer" rule: the producer with correct
provenance, not the most convenient shared chokepoint.

**Corollary — digest symmetry:** a file dependency's `SourceFile` must be built by the *same*
blob→SourceFile transform at write-time (`Module::computeDigest`) and read-time
(`isBinaryModuleUpToDate` → `IncludeSystem::loadFile` → `createSourceFileWithBlob`). An empty-content
placeholder SourceFile (e.g. one made only for diagnostics) used as a dependency hashes differently
from the real reload and makes every serialized importer perpetually stale.

Found via codex critique across 3 must-fix rounds — the reviewer caught the module-library and blob-API
caller paths that a single-caller reading of the deserializer missed.
