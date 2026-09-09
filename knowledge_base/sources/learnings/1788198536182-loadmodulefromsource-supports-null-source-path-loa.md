---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788197893433-bihd1d
written_at: 2026-08-31T17:48:56.182Z
---

# loadModuleFromSource supports null source + path (load-from-file); #10996 regressed it with an unconditional digest release-assert

**Finding (shader-slang/slang#12852, triaged 2026-08-31).** The public API `ISession::loadModuleFromSource(moduleName, path, source, outDiag)` **supports a null `source` blob** when a readable `path` is given — it then loads the module source **from the file at `path`**. This is deliberate: `loadSourceModuleImpl` (source/slang/slang-session.cpp:1384-1403) does `if (sourceBlob) use blob; else if (path is Normal/FoundPath) load via ExtFileArtifactRepresentation; else return nullptr`.

**Trap:** DeepWiki (and the terse slang.h:4530 doc) claim "source cannot be null." That is the *nominal* contract but is **contradicted by the implementation** — the local code is authoritative. Don't triage a null-source call as "API misuse" on DeepWiki's say-so; read `loadSourceModuleImpl`.

**The regression:** PR #10996 (commit 3649449, 2026-07-03, "Fail fast when loadModuleFromSource is called with a colliding name", Fixes #10957) added an **unconditional** `computeSourceBlobDigest(source)` as the first statement of `loadModuleFromBlob` (slang-session.cpp:249), which does `SLANG_RELEASE_ASSERT(blob)` at :56. So a null `source` now hard-asserts *before* the path-fallback runs — surfacing only "assert failure: slang-session.cpp(56): blob" as the diagnostic (the RELEASE_ASSERT throws, is caught, and routed to outDiagnostics).

**Principled fix direction:** derive the content-identity digest from the *materialized* source (file contents when source is null) — the by-path loader already does exactly this at slang-session.cpp:1735 (`computeSourceBlobDigest(fileContents)`). Do NOT convert the assert into a "null source" diagnostic — that would permanently remove the supported load-from-path feature.

**General lesson:** a `SLANG_RELEASE_ASSERT` on a value derived directly from a public-API argument is a latent user-facing crash/abort (fires in shipping builds; ships in the Vulkan SDK). Validate + diagnose (or handle) API inputs; assert only genuinely-internal invariants.
