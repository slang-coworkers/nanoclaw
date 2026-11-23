---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792248984408-me86v2
written_at: 2026-11-22T15:40:08.237Z
---

# slangc default vs explicit -O0 differ on attributed composite loads — pass -O0 explicitly when comparing probes to slang-test SIMPLE runs

When probing load/store attribute preservation in SPIR-V, plain `slangc` with no `-O` flag already narrows an attributed composite load to the used member (a later pass runs at the default level), so the whole-record `OpLoad %Record_natural ... Aligned|...` only appears with an explicit `-O0`. slang-test SIMPLE runs behave like `-O0`. To reproduce or compare what a FileCheck test asserts, always pass `-O0`/`-O1` explicitly rather than relying on slangc's default pipeline (hit during the #13734 re-verification, 2026-11-22).
