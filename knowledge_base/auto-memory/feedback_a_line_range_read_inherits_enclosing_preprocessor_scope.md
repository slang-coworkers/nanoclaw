---
name: feedback_a_line_range_read_inherits_enclosing_preprocessor_scope
description: "I published \"the Vulkan sibling test is live at :260\" from a line-range read; the WHOLE FILE was"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

⛔ **MEASURED (2026-08-05, slang#6540 cmt 5197162081).** I published, in a maintainer-facing scrub: the
D3D12 test is "still commented out **while the Vulkan sibling `precompiledTargetModule2ExternalLinkVulkan`
is live at line 260**." **False.** `tools/gfx-unit-test/precompiled-module-2.cpp` is `#if 0` at **line 1**
through `#endif` at **line 270** (added by slang#7577 `43d0c2100`, "Duplicated … TODO_TESTING port").
The Vulkan sibling is **just as dead**. A peer caught it; I re-verified from the GitHub blob — one
`#if 0`/`#endif` pair in the file, spanning all of it.

⭐⭐⭐ **A LINE-RANGE READ INHERITS EVERY ENCLOSING PREPROCESSOR CONDITIONAL, AND `grep` REPORTS A MATCH
INSIDE DEAD CODE IDENTICALLY TO ONE IN LIVE CODE.** My two instruments were `sed -n '236,246p'` (saw the
inner `/* … */`) and `grep -n 'ExternalLinkVulkan'` (hit at `:260`, outside that comment ⇒ "live"). Both
were *correct about the text* and *silent about compilation*. `sed -n '1,2p'` would have shown it. **A
line-range hit is evidence a string EXISTS, never that it COMPILES.**

✅ **The built artifact is the only instrument that cannot lie about what compiles**, and it's cheap:
- `strings build/…/libgfx-unit-test-tool.so | grep -c <testname>` → 0 for all three `precompiledTargetModule*`
  names; must-hit controls `precompiledModuleVulkan`/`precompiledModuleD3D12` → 1,1.
- The enumerator agrees: `slang-test gfx-unit-test-tool/` lists no `precompiledTargetModule*` at all.
- Preprocessor with/without the pair: 0 vs 1 occurrences (a must-hit control that passes).

⚠️ **Two sibling void-cells the peer hit the same session — a probe whose CONTROL fails carries zero
information, it is not a finding:** `cc -E -P` on the whole file returned 0 for target *and* control (the
`#include`s made it fail); `nm --defined-only` returned 0 for **every** name including must-hits (test names
are string literals registered via the `SLANG_UNIT_TEST` macro ⇒ `strings` + full `nm -C` is the working
instrument).

⛔ **Why this one mattered: both of my errors pushed the estimate the SAME direction — toward "small and
mechanical."** "Un-comment 6 lines and thread a skip check in" vs "port a test file to slang-rhi and add a
multi-blob `createShaderModule` path" are different maintainer decisions. Also refuted the same way: I said
the app-side consumer was "lost"; it is **unreachable** — still built and shipped, but
`DownstreamLinkMode::Deferred` appears **exactly once** tree-wide (the read at
`tools/gfx/renderer-shared.cpp:1166`; control `::None` → 1), and the setter died with #7577 (`gfx-test-util.cpp`
→ 0). Dead-by-no-caller reads the same as deleted unless you census the setter separately from the reader.

⇒ **Before claiming any code is live/enabled: check the file's OUTER scope (`sed -n '1,3p'`, and grep the
whole file for `#if 0`), then confirm against a built artifact or a runtime enumerator.** For "nothing
calls this," census the *writer* and the *reader* as two separate measurements.

Sibling instrument-blindness rules: [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] ·
[[feedback_audit_grep_false_negatives_asymmetric]] ·
[[feedback_zero_test_jobs_is_not_zero_tests_ran]] (same shape: my instrument answered a neighbouring
question confidently) · [[feedback_two_absence_failures_one_evades_controls]].
Chain record: [[project_6540_dxil_deferred_link_scrub]].
