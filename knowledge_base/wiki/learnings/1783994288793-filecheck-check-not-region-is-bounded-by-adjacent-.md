---
title: "FileCheck CHECK-NOT region is bounded by adjacent positive matches (whole-file negatives need a top anchor)"
type: learning
topic: misc
source: learnings/1783994288793-filecheck-check-not-region-is-bounded-by-adjacent-.md
---

# FileCheck CHECK-NOT region is bounded by adjacent positive matches (whole-file negatives need a top anchor)

**Rule:** A `CHECK-NOT`/`SPV-NOT`/`GLSL-NOT` only scans the region between its **preceding** positive `CHECK` (or buffer start) and its **following** positive `CHECK` (or EOF). So `CHECK: void main(` then `CHECK-NOT: imat` does NOT scan the whole output — it only scans *after* the `void main(` match. A forbidden token emitted **earlier** (e.g. in a GLSL buffer-block / `layout(...) buffer {...}` declaration, which is emitted BEFORE `main`, or SPIR-V type decls before `OpEntryPoint`) is silently missed → false-green negative check.

**Fix:** to make a negative check cover the whole output, anchor the preceding positive at the **first output line** (`GLSL: #version` / `SPV: OpCapability`) and put NO positive `CHECK` after the `-NOT`s. Then the `-NOT` region is `[first-line match, EOF)` = whole file. (Leading `CHECK-NOT` with no positive before it also works — scans `[start, first positive/EOF)`.)

**Why it matters (slang #11987, pdeayton-nv review):** a `legalizeMatrixTypes` early-out regression test checked `GLSL: void main(` → `GLSL-NOT: imat`. An un-lowered `int2x2` prints as `imat2x2` **in the buffer struct, ahead of `main`** — so the check would have passed even on a real regression. Same latent bug in the mixed-cast sibling test (`GLSL: uvec2` → `GLSL-NOT: umat` only scanned after `uvec2`).

**Gotchas:**
- GLSL integer matrix keyword is assembled at emit time as prefix + `mat` (`i`+`mat`+`2x2` = `imat2x2`, `u`+`umat`; from `_emitGLSLTypePrefix` in slang-emit-glsl.cpp). `grep imat source/` finds nothing — the literal never appears in source. Guard BOTH `imat` and `umat`.
- Positive-existence checks (`CHECK: OpTypeMatrix`, `CHECK: mat2x2`) are inherently order-independent — no fix needed for "X must survive".
- FileCheck IS available in the slang-test harness (tests run as real matches, not the "FileCheck absent → SIMPLE ignored" case) — so verify by running slang-test AND by hand-checking token positions in the emitted output.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783994288793-filecheck-check-not-region-is-bounded-by-adjacent-.md`_
