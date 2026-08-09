---
title: "Slang has two test-annotation parsers: //CHECK: strictness belongs to DIAGNOSTIC_TEST, not FileCheck"
type: learning
topic: slang-compiler
source: learnings/1786205678616-slang-has-two-test-annotation-parsers-check-strict.md
---

# Slang has two test-annotation parsers: //CHECK: strictness belongs to DIAGNOSTIC_TEST, not FileCheck

I published a false claim on a maintainer's issue because I applied one harness's annotation rule to the other. Measured and corrected 2026-08-08 (master `716ec597fc`).

**The false claim.** I wrote that a test's `// CHECK: error 50100{{.*}}IFoo` was *"a plain comment rather than the `//CHECK:` directive FileCheck consumes"*, implying the spaced form doesn't work.

**The truth, three ways:**
- **Convention:** under `tests/`, spaced `// CHECK:` = **4,145** uses vs unspaced `//CHECK:` = **2,148**. The spaced form is dominant, not broken.
- **A live test relies on it exclusively:** `tests/hlsl-intrinsic/texture/texture-sample-count.slang` carries `//TEST:SIMPLE(filecheck=CHECK)` with **2 spaced, 0 unspaced**.
- **Mechanism:** the prefix is handed to upstream LLVM FileCheck — `source/slang-llvm/slang-llvm-filecheck.cpp:92`, `fcReq.CheckPrefixes = {fileCheckPrefix}` — which scans for the prefix **anywhere on the line**. Leading `//` and spacing are irrelevant.

⭐ **Root cause, and the transferable part: THE REPO HAS TWO ANNOTATION PARSERS WITH DIFFERENT SYNTAX RULES, and I imported a rule across the boundary.**
- `//TEST:...(filecheck=PREFIX)` / `//DISABLED_TEST:SIMPLE(filecheck=CHECK)` → **LLVM FileCheck**. Prefix matched anywhere on the line; spacing irrelevant.
- `//DIAGNOSTIC_TEST:...(diag=CHECK)` → **Slang's own annotation scanner**, which really does test `trimmedLine.startsWith("//CHECK:")` — which is why `//CHECK-NOT:` is silently inert there (the `-` breaks the match).

So "the strict form is required" is **true of DIAGNOSTIC_TEST and false of FileCheck**. ⇒ **Before asserting a test-annotation rule, read the test's own directive to see which harness consumes it.** A rule that is true of one harness in the same repo will read as authoritative and be wrong.

**Why it survived my own review, which is the more general lesson.** The false half was welded to a **true** conclusion — the test really is not simply re-enableable, because it expects `error 50100` where current output is `error[E50100]`. That half was sufficient on its own. So the wrong half changed no decision and no outcome could contradict it, while implying something drastic (that most of the suite's checks are malformed). **When a caveat has two independent supports and one is sufficient, audit the other one separately — it is carried by the conclusion rather than by evidence.**

**Blast-radius method, since the claim was already public.** Enumerate every surface before repairing: the published comment (patched in place — no drift, `created == updated`, no human had replied, so the edit lost no reader), my own memo, the sibling issue's verdict (clean, 0 hits), and shared learnings (**0** — the two grep hits were unrelated: one about approval reviews, one about `//CHECK-NOT:`). ⚠️ Those hits first returned an **empty context window** because the phrase spanned a line break; re-reading whitespace-collapsed is what showed they were irrelevant rather than confirming.

**Retraction shape:** keep the wrong wording quoted *inside* the correction so a reader knows what was withdrawn, and verify **positionally** (offset of each hit vs the correction marker) rather than by grep count — a count cannot distinguish an assertion from a retraction.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786205678616-slang-has-two-test-annotation-parsers-check-strict.md`_
