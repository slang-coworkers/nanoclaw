---
title: "Don't key a guard on a diagnostic you assume is emitted — and a skip needs a negative control more than an ordinary fix does"
type: learning
topic: misc
source: learnings/1786184707221-don-t-key-a-guard-on-a-diagnostic-you-assume-is-em.md
---

# Don't key a guard on a diagnostic you assume is emitted — and a skip needs a negative control more than an ordinary fix does

Two findings from one bug fix (shader-slang/slang, 2026-08-08). Both are about the *shape* of a fix, not the domain.

## 1. A guard keyed on a diagnostic assumes the diagnostic exists

My unit test failed on Windows only, because `createArtifactFromIR` skips its whole link-and-validate block when the runtime-loaded `slang-glslang` module is unavailable — so the compile returns the module the compiler emitted itself, and my assertion that the *downstream linker* wrote the header could not hold.

**My first fix keyed the skip on the `E00100` "failed to load downstream compiler" diagnostic.** Reasonable: a failed load surely reports itself. I built a probe to reproduce the state — using the product's own `setDownstreamCompilerPath(SLANG_PASS_THROUGH_SPIRV_OPT, "/tmp/emptydir")` — and got:

```
codeResult=0x00000000  producedCode=1  generator=0x00280000 (tool 40, not the linker's 17)
DIAGS: (empty)
```

Mechanism confirmed, **guard unusable**: no diagnostic. The reason is an explicit design choice, commented in-source (`slang-check.cpp:123-128`): the locator *"might probe multiple possible library versions/names, and failing to load one library should not be taken as a hard error."*

⭐ **The rule: key a guard on state you can read, not on a message you hope exists.** *"This failure surely reports itself"* is among the least-checked assumptions available, because it feels like a property of failure rather than a decision someone made. The working guard reads the generator word — an observable in the artifact — and skips when it is the compiler's own id instead of the linker's.

**Corollary:** when you catch yourself writing `if (diagnostics.indexOf("E<code>") != -1)`, first prove that code is emitted on the exact path you care about. Probe it; don't reason from "an error occurred, so an error was reported."

## 2. A skip can silently delete coverage, so it needs its negative control most

The fix converts a failure into `SLANG_IGNORE_TEST`. **Every skip has a failure mode ordinary patches don't: "the test passes now" is indistinguishable from "the test no longer tests anything."** Both produce green.

The cell that makes it a fix rather than a change:

| guard | module | result |
|---|---|---|
| present | present | **PASS** (link ran, assertion held) |
| present | absent | **skip**, exit 0 |
| **removed** | **absent** | **EXIT=1, 0/1** ← the load-bearing cell |

Without the third row I'd have had no evidence the guard does anything. It also converted an *inferred* trigger (read from someone else's CI census) into a *measured* one, by reproducing the platform's state locally — I moved the `.so` aside in my own build tree, backed up, restored, `cmp` byte-identical.

**Practical:** to reproduce a "module unavailable" state without a second machine, prefer the product's own path-override API; failing that, move the library aside in a build tree you own (never a sibling's), back it up first, and verify byte-identity after restoring.

## 3. The honest form of "fixed"

⚠️ **A correct skip and an unfixed environment produce the same green.** I established that the failure follows from the module being unavailable, and that the skip handles it. I did **not** establish *why* the module fails to load on that platform — so the accurate report is *"the test no longer misreports; the platform is still uncovered,"* with the packaging question carried as a separate open item. Saying "fixed" unqualified would have let a green CI imply coverage that doesn't exist.

Related: the nit that predicted this was raised in review (a missing skip path for builds without that module) and I **declined it as covering an unreachable configuration**. It was reachable — on the one platform where every job had been skipped for two days, so its results were *absent*, not green. **A nit dismissed as unreachable is exactly the nit to re-check when a platform's results are absent rather than passing.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786184707221-don-t-key-a-guard-on-a-diagnostic-you-assume-is-em.md`_
