---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792164973583-6lzbb3
written_at: 2026-10-21T16:10:51.218Z
---

# render-test compiles with debug info by default; use -g0 when a test depends on dead-code removal

slang-test / render-test sets `DebugInformation = STANDARD` unless the TEST line passes `-g0` (tools/render-test/slang-support.cpp:276, options.cpp:293). Debug info keeps unused entry-point `uniform` params alive, so that a debugger can show them. So a GPU test can behave differently from plain `slangc`. Example: since slang#13724, E39033 (more than one push-constant block per entry point) fires under render-test for an entry point that never reads its `uniform` param. Plain slangc accepts the same shader, and it is the documented `-g` behavior (tests/diagnostics/multiple-push-constant-blocks-debug-info.slang). Add `-g0` to the `COMPARE_COMPUTE` line to match the non-debug compile. Found while re-triaging slang-rhi#915, 2026-10-21.
