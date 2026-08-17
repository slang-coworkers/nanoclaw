---
title: "Emit/header changes: diff against FileCheck goldens even when FileCheck is absent locally"
type: learning
topic: misc
source: learnings/1784421575539-emit-header-changes-diff-against-filecheck-goldens.md
---

# Emit/header changes: diff against FileCheck goldens even when FileCheck is absent locally

**Rule:** When a compiler change can alter emitted output (emitters, lowering decorations, anything reaching a `//TEST:SIMPLE(filecheck=CHECK)` header/emit golden), a green "no compile error" run is NOT a passing test. FileCheck is usually absent in-container, so `slang-test` silently SKIPS these SIMPLE tests rather than running them — you get no signal. You MUST diff the actual slangc output against the golden's `//CHECK:` lines by hand, for EVERY affected golden, not just the one you added.

**Why (cost incurred, slang#9401 / PR #12156, 2026-07-19):** A lowering change added `HLSLExportDecoration`+`KeepAliveDecoration` to the `ExternCppModifier` arm to root `__extern_cpp` functions. But `__extern_cpp` also attaches to structs/fields/globals (e.g. `tests/headers/generate-cuh-header.slang:15-19` marks a struct + its fields). Rooting those reordered `.cuh` emission → `test-slang` failed IDENTICALLY on 7 platforms (uniform-across-arch = deterministic output change, all builds green = FileCheck mismatch, NOT golden-drift). I had manually grepped the NEW test's CHECKs and the sibling hpp golden, but skipped the cuh golden — and it shipped to a maintainer-approved PR before the shadow approver caught the RED.

**How to apply:**
- Before shipping an emit/lowering change: `grep -rl "__yourfeature__\|the modifier/inst you touched" tests/` and run slangc `-target <t> -line-directive-mode none` on EACH hit, eyeballing output vs its `//CHECK:` lines (order matters — FileCheck CHECKs are ordered).
- A modifier/decoration arm shared by multiple decl kinds (function vs type vs field vs global) is the classic over-broad trap: narrow the change to the intended decl kind (`as<CallableDecl>(decl)` for functions-only) rather than rooting everything the arm sees.
- "Uniform failure across all arches/OSes" in CI = deterministic output/logic change (real regression); "one platform only" = likely golden-drift/flake. Use this to triage red fast.
- Don't trust `slang-test <file>` exit 0 when FileCheck is missing — confirm FileCheck presence (`which FileCheck`) or the SIMPLE test was a no-op.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784421575539-emit-header-changes-diff-against-filecheck-goldens.md`_
