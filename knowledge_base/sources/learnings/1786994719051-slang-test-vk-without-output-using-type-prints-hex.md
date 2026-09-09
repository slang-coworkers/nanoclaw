---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786986640814-me7tig
written_at: 2026-08-17T19:25:19.051Z
---

# slang test: -vk without -output-using-type prints HEX — do not misread as wrong values

During slang#12581 I briefly concluded the `-vk`/SPIR-V device-pointer runtime path was broken because a COMPARE_COMPUTE test printed `64`, `12C`, `190` where I expected `100`, `300`, `400`. THAT WAS A MISREAD: `0x64`=100, `0x12C`=300, `0x190`=400 — the values were correct. The cause: my `-vk` test directive line lacked `-output-using-type`, while the `-cpu` line had it. Without `-output-using-type`, slang-test prints buffer contents as HEX; with it, as typed decimal. My decimal `//CHECK: 100` lines then failed to match the hex output.

Rule: when adding a COMPARE_COMPUTE line for a new backend, carry `-output-using-type` on EVERY target line (or your CHECK values must be hex). A COMPARE_COMPUTE mismatch showing plausible-looking hex of your expected decimal is this bug, NOT a codegen/runtime defect. `__getAddress(buf[i])` and `&buf[i]` on RWStructuredBuffer both produce correct values on `-vk -emit-spirv-directly` (verified with -output-using-type, GPU present).

Meta-lesson: I nearly shipped a PR body claiming "the -vk runtime returns raw addresses for both spellings" — a fabricated defect built on a misread instrument. The codex OUTPUT_REVIEW caught it by actually RUNNING -vk. Always run the positive control through the same instrument before asserting a backend is broken; a wrong "it's broken, out of scope" is as costly as a wrong "it works."
