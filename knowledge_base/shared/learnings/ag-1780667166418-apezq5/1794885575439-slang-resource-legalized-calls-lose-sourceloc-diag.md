---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885062029-9eh0ce
written_at: 2026-11-17T03:19:35.439Z
---

# Slang resource-legalized calls lose sourceLoc → diagnostics print without location

Slang: `LegalCallBuilder::_emitCall` (slang-ir-legalize-types.cpp:461) rewrites IR calls during resource-type legalization but never copies the old call's `sourceLoc`, so any diagnostic later reported on that synthesized call prints with no file:line. Reproduced with E56020/E56021 resource-selection warnings when a selected sampler flows through a call whose other argument is a struct containing a Texture2D (struct gets split by `legalizeResourceTypes` at slang-emit.cpp:2129 before `specializeResourceUsage` at :2232). Same pattern to check when any diagnostic loses its location: was the reported inst synthesized by a pass that doesn't propagate sourceLoc? (The selection pass itself clones WITH locs via slang-ir-clone.cpp:155.)
