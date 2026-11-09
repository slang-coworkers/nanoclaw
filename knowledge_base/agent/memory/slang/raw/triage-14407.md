---
type: source
description: "render-test skips indented `//TEST_INPUT:` (shader-input-layout.cpp:1047 startsWith before trim); vk reads 0, cpu SIGSEGV, cuda abort; bug/low/P3; rec A = normalize like slang-test + cpu/vk/cuda test; unbound-param crash split to #14409"
okf_synth: exempt
---
# Triage: shader-slang/slang#14407 — render-test ignores indented `//TEST_INPUT:` lines, leaving the parameter unbound
Date: 2026-11-08 | bug | low | P3 | test harness (tools/render-test)

## What's broken
render-test's TEST_INPUT parser only sees lines whose first two chars are `//`. An indented
`    //TEST_INPUT:...` (natural next to an entry-point param) is silently skipped, so the param is never
bound. slang-test's own `//TEST` scan accepts leading whitespace, `///TEST` and `// TEST`, so the two
scanners disagree. Not a regression (check dates to 2020, last touched a6deb5ed8 #8526 2025-09).

## Repro (master ae4e5795, Release rebuilt 2026-11-08, L40S)
Reporter's test verbatim, `-vk` / `-cpu` / `-cuda` variants, `slang-test <file>` (in-process default spawn):
- indented: vk → `0.000000`, FAILED (no diagnostic); cpu → slang-test SIGSEGV exit 139;
  cuda → `CUDA_ERROR_ILLEGAL_ADDRESS` at slang-rhi cuda-command.cpp:940, assert abort exit 134.
- column-0: vk / cpu / cuda all pass.
- `-use-test-server`: crashes contained, reported as FAILED ("killed a freshly spawned test server twice").
- same crash with the TEST_INPUT line deleted entirely → the crash is "unbound param", not indentation (cf. #12499).

## Codebase digest
- `tools/render-test/shader-input-layout.cpp:1047` `if (!line.startsWith("//")) continue;` on the raw line;
  `:1049` `tail(2).trim()`; `:1050` only prefix `TEST_INPUT:`. `// TEST_INPUT:` works (82 tracked lines);
  `///TEST_INPUT:` → `/TEST_INPUT:` → dropped.
- `tools/slang-test/slang-test-main.cpp:664` `skipHorizontalSpace`, `:666` `match("//")`, `:672-677` skip extra
  `/` + whitespace ("malformed directives like ///TEST or // TEST"). Helpers file-local (`:197`, `:212`).
- Tracked tests: 0 indented `//TEST_INPUT`, 0 `///TEST_INPUT` → fix changes no existing test.
  `tests/compute/dynamic-dispatch-11.slang:35` has a mid-line `//TEST_INPUT` inside a `// ...` comment — must stay
  ignored (a leading-whitespace trim keeps it ignored; a "search anywhere in line" fix would not).
- Errors: `ShaderInputLayoutFormatException` (`:71`), caught in `render-test-main.cpp:2155` → SLANG_FAIL.
- Binding: `render-test-main.cpp:947-960` `_assignVarsFromLayout` walks TEST_INPUT entries only; errors on
  entry-without-param, never on param-without-entry.
- Crash path: `test-context.cpp:355-366` Default spawn → UseSharedLibrary for default output mode;
  render-test runs in slang-test's process. slang-rhi CPU leaves unbound StructuredBuffer `{nullptr,0}`;
  `prelude/slang-cpp-types.h:62-65` `operator[]` → `data[index]` (bound check is a no-op by default).
  Vulkan binds a null descriptor (robustness2.nullDescriptor) → reads 0; Metal skips the bind.

## Candidate approaches
### A: normalize the line in `parse()` like slang-test does (RECOMMENDED for #14407)
- Where: shader-input-layout.cpp:1047-1049.
- Delta: trim leading horizontal whitespace before the `//` check; after `//`, skip extra `/` then trim.
  Indented and `///` TEST_INPUT lines are honoured.
- Tradeoffs: tiny; zero tracked tests change. Optional: a shared helper (e.g. in
  `source/core/slang-test-tool-util.h`, already used by render-test) so both tools use one rule — nice for
  "one source of truth" but more blast radius; fixer's call.
- Risk: an indented TEST_INPUT inside a `/* */` block would now activate — same as slang-test's `//TEST` today.
### B: reject instead of accept
- Where: same loop; if the trimmed line starts with `//...TEST_INPUT:` but the raw line doesn't, throw
  `ShaderInputLayoutFormatException("TEST_INPUT must start at column 0, line N")`.
- Tradeoffs: keeps the column-0 rule, still loud. Diverges from slang-test's `//TEST` behaviour; reporter
  prefers honouring. Second choice.
### C: fail loudly on any unbound resource parameter (SEPARATE follow-up)
- Where: after `applyBinding` (`render-test-main.cpp:962`): walk global + entry-point param reflection; error
  naming any resource param no TEST_INPUT touched.
- Delta: covers #14407, #12499 (no TEST_INPUT at all), `#include`d TEST_INPUTs, typos → diagnostic, not a 0
  read or crash, on every backend.
- Tradeoffs: larger; may flag existing tests that rely on null-descriptor reads on vk/d3d → needs a full-suite
  run and maybe an opt-out. Different root cause (no reverse check), so its own issue/PR.
### D (rejected): null check in CPU prelude `StructuredBuffer::operator[]`
- Masks the missing binding, adds cost to every generated CPU access, CUDA would still crash. Wrong layer.

## Recommended path
Approach A in one small PR: in `parse()` (shader-input-layout.cpp:1047-1049) skip leading spaces/tabs, match
`//`, skip extra `/`, trim, then match `TEST_INPUT:`. Add regression test (e.g.
`tests/compute/entry-point-uniform-params-indented-test-input.slang`) with the reporter's shader and
TEST lines for `-cpu`, `-vk`, `-cuda` (and `-mtl` if the suite has a metal lane), checking `2.0`.
Repro: `./build/Release/bin/slang-test tests/<new-test>.slang` — before fix vk prints 0.0, cpu SIGSEGVs
(139), cuda aborts (134); after fix all PASS.
Accept: new test passes on cpu/vk/cuda; `tests/compute/` + `tests/render/` pass with `-use-test-server`;
`dynamic-dispatch-11.slang` unchanged. The `-cpu` crash for a genuinely unbound param is Approach C, tracked
separately — not in this PR.

## Sources
- DeepWiki: render-test binds via `_assignVarsFromLayout`, no all-params-bound validation; render-test-tool is
  loaded in-process unless `-use-test-server`, so CPU/CUDA kernel crashes kill slang-test.
- Shared learnings: indented TEST_INPUT gotcha seen during #9643/PR #14108; #12499 (`-cpu` SIGSEGV from a test
  with no TEST_INPUT); TEST_INPUT in `#include`d files also dropped.
- Dupes: none (searched TEST_INPUT indented / shader-input-layout / unbound / missing TEST_INPUT).
