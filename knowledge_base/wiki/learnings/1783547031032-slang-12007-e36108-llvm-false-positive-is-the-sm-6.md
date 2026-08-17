---
title: "slang#12007 E36108 'llvm' false-positive is the sm_6_0 alias listing cpp/llvm, NOT auto-available-because-linked"
type: learning
topic: slang-compiler
source: learnings/1783547031032-slang-12007-e36108-llvm-false-positive-is-the-sm-6.md
---

# slang#12007 E36108 'llvm' false-positive is the sm_6_0 alias listing cpp/llvm, NOT auto-available-because-linked

**Issue #12007 (verified @ HEAD d8e8e1a9e).** `[require(sm_6_0)]` + a GPU-only op (`Texture2D.Sample`) on a public decl/entry point → `error[E36108]: dependencies not compatible on target 'llvm'`, even compiling only `-target spirv`. Emit site is `SemanticsDeclCapabilityVisitor::diagnoseUndeclaredCapability` @slang-check-decl.cpp:21396 (the `hasTargetAtom` branch), reached from the public-decl `checkCapabilityRequirement` call @:20642.

**The report's (and prior learning 1783471474036's) stated mechanism — "llvm is auto-available as a capability-target atom at loadModule whenever slang-llvm is linked, so the check evaluates against llvm regardless of TargetDesc" — is WRONG.** Two controls refute it: (a) it reproduces on a Debug slangc that has NO libslang-llvm.so in its lib/; (b) `[require(spirv_1_3)]` + the same op compiles CLEAN. If `llvm` were injected merely by linking, both would still error.

**Actual root cause: the `sm_6_0` alias literally includes cpp+llvm as target disjuncts.** `slang-capabilities.capdef:1778-1789`: `alias sm_6_0_version = _sm_6_0 | _GLSL_450 | spirv_1_3 | _cuda_sm_6_0 | metal | cpp | llvm;`. So `[require(sm_6_0)]` declares availability on cpp/llvm too, and the front-end public-decl consistency check requires the body to be implementable on EVERY named target disjunct. `Sample` has no cpp/llvm impl → fail. The message says `llvm` (not cpp) only because `hasTargetAtom()` (slang-capability.cpp:523-533) returns `.getLast()` of the failing intersection and `llvm` (`def llvm : target;` @capdef:124) is highest-ordered among target atoms; cpp fails equally. Target-independent (spirv/dxil/hlsl all give E36108) because it's a declaration-consistency check, not a codegen/session check. Internal (non-public) decls are exempt — the check is public-decl-only.

**Is it a bug? Semantics call, not a code fact.** DeepWiki + current design: by-design — `[require(X)]` means "implementable on every target disjunct of X", and sm_6_0 intentionally lists cpp/llvm for CPU-debuggability, so the diagnostic is correct. User intent (#11989): false positive — `[require(sm_6_0)]` on a fragment shader reads as "HLSL SM 6.0". Both consistent.

**Fix options:** (A) narrow the `[require]` at use sites — `[require(spirv, sm_6_0)]` compiles clean, zero risk, unblocks #11989's reflection-api example (examples/reflection-api/raster-simple.slang:59,77 uses exactly the offending pattern). (B) drop cpp/llvm from every `sm_*_version` alias in capdef — general fix, HIGH blast radius on the capability lattice, needs full capability suite. #12007 is jkwak-self-filed+self-assigned → parked as maintainer semantics call, no auto-fixer.

**Meta-lesson:** always run the discriminating control before relaying a plausible mechanism. `[require(spirv_1_3)]`-clean vs `[require(sm_6_0)]`-error is a 30-second test that flips "linked-library leak" into "alias-membership". The prior #11989 learning propagated the wrong mechanism because nobody ran that control.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783547031032-slang-12007-e36108-llvm-false-positive-is-the-sm-6.md`_
