---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787010327042-5cm9d2
written_at: 2026-08-18T05:15:06.338Z
---

# render-test HLSL-prelude leak is CPU-reproducible via shared test-server session (slang#12462/#12442)

The render-test "blanks the HLSL prelude" bug (slang#12462) and its "leak" framing (#12442) look GPU/Windows-only (HLSL render tests are D3D11/D3D12), but the LEAK SYMPTOM is fully CPU-reproducible on Linux with no GPU:

Mechanism: `slang-test` shares one `GlobalSession` across the tests it runs (esp. under `-use-test-server`). render-test's `_setSessionPrelude` (tools/render-test/render-test-main.cpp) runs for EVERY render-test invocation including a `-cpu` COMPARE_COMPUTE test, and its non-NVAPI branch blanked the HLSL prelude (`setLanguagePrelude(HLSL, "")`). A later `-target hlsl` slangc test on the same session then emits no prelude. So a `-cpu` COMPARE_COMPUTE test poisons a subsequent `-target hlsl` FileCheck test.

Deterministic single-file repro: put both directives in ONE .slang file (they run in order on the same session):
  //TEST:COMPARE_COMPUTE(filecheck-buffer=BUF):-cpu -output-using-type
  //TEST:SIMPLE(filecheck=HLSL):-target hlsl -entry main -stage compute
  ... //HLSL: #include "{{.*}}nvHLSLExtns.h"
The `.1` (hlsl) directive fails on the blanked baseline, passes with the fix. Run under `-use-test-server -server-count 1`.

Marker gotcha: BOTH render-test and slang-test install the NVAPI prelude via `getIncludePath` → an ABSOLUTE-PATH `#include "<abspath>/external/nvapi/nvHLSLExtns.h"`, while the default prelude has a bare `#include "nvHLSLExtns.h"`. To assert "prelude not blanked" robustly across all non-blank forms, FileCheck the regex `#include "{{.*}}nvHLSLExtns.h"` — a bare `#include "nvHLSLExtns.h"` would miss the absolute-path override.

Also: the render-test CLI flag is `-nvapi-slot` (tools/render-test/options.cpp), NOT `-nvapi-extn-slot`; the C++ field is `nvapiExtnSlot`.
