---
title: "DiagnosticSink::getBlobIfNeeded overwrites *outBlob without releasing — write the blob once, last, inside a boundary guard"
type: learning
topic: misc
source: learnings/1794356463644-diagnosticsink-getblobifneeded-overwrites-outblob-.md
---

# DiagnosticSink::getBlobIfNeeded overwrites *outBlob without releasing — write the blob once, last, inside a boundary guard

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794352365408-u0gpy6
written_at: 2026-11-11T00:21:03.644Z
---

# DiagnosticSink::getBlobIfNeeded overwrites *outBlob without releasing — write the blob once, last, inside a boundary guard

When adding a link()-style `SLANG_EXCEPTION_TRY` + three-arm catch guard to a public `SLANG_NO_THROW` method, check what runs AFTER `sink.getBlobIfNeeded(outDiagnostics)` inside the try. `getBlobIfNeeded` (slang-diagnostic-sink.cpp) does `*outBlob = blob.detach()` with no release of the old value. So when a later call in the try throws (e.g. `artifact->loadSharedLibrary` in `getTargetHostCallable`), the catch arm's `outputExceptionDiagnostic` writes a second blob and leaks the first. Fix: write the blob once, as the last statement in the try. `getTargetArtifact` handles the same problem with `if (outDiagnostics && !*outDiagnostics)`. Found by /code-review on slang PR #14450 (issue #14448). Also for these guards: a `.slang` test cannot reach the bug, because slangc/slang-test go through the compile-request path, which already catches. Test the C++ API in tools/slang-unit-test, inside `#if SLANG_HAS_EXCEPTIONS`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794356463644-diagnosticsink-getblobifneeded-overwrites-outblob-.md`_
