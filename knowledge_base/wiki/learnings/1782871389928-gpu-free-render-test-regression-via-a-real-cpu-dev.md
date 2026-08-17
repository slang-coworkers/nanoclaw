---
title: "GPU-free render-test regression via a real CPU device in gfx-unit-test"
type: learning
topic: misc
source: learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md
---

# GPU-free render-test regression via a real CPU device in gfx-unit-test

When a Slang render-test / DeviceCache fix needs a **GPU-free regression test** that exercises real RHI device code (not just a mock), create a real **CPU-backend** device inside a `gfx-unit-test` `SLANG_UNIT_TEST`:

- Gate on availability, skip gracefully: `if ((unitTestContext->enabledApis & Slang::RenderApiFlag::CPU) == 0) { SLANG_IGNORE_TEST }` (needs `#include "core/slang-render-api-util.h"`), and also `SLANG_IGNORE_TEST` if `createDevice` fails. The CPU backend is enabled in normal CI and creates headlessly.
- Set `desc.deviceType = rhi::DeviceType::CPU; desc.slang.slangGlobalSession = unitTestContext->slangGlobalSession;` — the CPU device needs the global session (mirrors `createTestingDevice` in gfx-test-util.cpp). Do NOT set `desc.debugCallback = unitTestContext->debugCallback` unless you want harness RHI-error capture to flip Ignored→Fail.
- Confirmed working: `deviceCacheReusesDebugBridgeAcrossInvocations` (slang#11856, PR #11866) ran with "Check cpu: Supported", created a real CPU device via `DeviceCache::acquireDevice`, all assertions green.

**Include-path rule (maintainer jkwak):** never use `../` in `#include` from a `tools/` subdir — `tools/` is on the include path, so `"render-test/slang-support.h"` / `"unit-test/slang-unit-test.h"` / `"core/..."` resolve directly.

**Don't overclaim a stand-in test's coverage:** a unit test that hand-emits through an object (e.g. `bridge.handleMessage(...)`) observes THAT object, not the real producer→object wiring. codex CODE_REVIEW rejected "deleting `debugCallback=bridge` fails this test" — it didn't, because the manual emit + identity checks still passed. State honestly what is OBSERVED vs MODELED; the real wiring is by inspection.

**codex OUTPUT_REVIEW is ruthless on exhaustive claims:** "the only paths that return before X are A/B/C" is false the moment any other return exists (error bail-outs, etc.). Rephrase as a dichotomy — "every return before X either does <property> or is an error bail-out" — which is exhaustive-safe. Also: the PostToolUse hook's "verdicts: OUTPUT_REVIEW=approve" summary can misparse a must-fix as approve; trust the codex response CONTENT, not the hook line.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782871389928-gpu-free-render-test-regression-via-a-real-cpu-dev.md`_
