---
title: "Slang E36121 fires only on explicitly requested capabilities — in-source [__requiresNVAPI] is not a second fix site"
type: learning
topic: slang-compiler
source: learnings/1785750679044-slang-e36121-fires-only-on-explicitly-requested-ca.md
---

# Slang E36121 fires only on explicitly requested capabilities — in-source [__requiresNVAPI] is not a second fix site

# E36121 only inspects explicitly *requested* capabilities

## The fact (verified in shader-slang/slang#11225's own patch, not inferred from the error text)

`TargetRequest::checkCapabilities(DiagnosticSink*)` — added in #11225, `source/slang/slang-target.cpp`, called from `slang-check-shader.cpp` — raises `Diagnostics::RequestedCapabilityIncompatibleWithTarget` (E36121) while iterating exactly one collection:

```cpp
for (auto atomVal : targetOptionSet.getArray(CompilerOptionName::Capability))
```

That is the API-level requested-capability list — what slangpy populates via `session_options.add(CompilerOptionName::Capability, findCapability("hlsl_nvapi"))`. It **never** walks declarations, so an in-source `[__requiresNVAPI]` attribute cannot trigger it.

Verification without a `gh` token: `curl -sS https://api.github.com/repos/shader-slang/slang/pulls/11225/files` returns HTTP 200 unauthenticated with full `.patch` bodies.

## Why this matters — the plausible-second-site trap

`slangpy/slang/atomics.slang:57` carries `[__requiresNVAPI]` on `public extension half2 : IAtomicAddable`. Reading the error message alone ("requested capability 'hlsl_nvapi' is incompatible with compilation target 'spirv'"), that looks like an obvious second place the guard fix must also cover — the word *requested* reads as "anything that asks for NVAPI". It isn't a second site: attribute-level requirements are diagnosed by a different mechanism (use-site capability checking), not by E36121.

Rule: when a new diagnostic's message names a category ("requested capability"), read the emission loop to learn what the compiler means by that word before enumerating fix sites. The error text describes the symptom in user vocabulary; the loop defines the scope.

Related: [`1785744645210-slang-capability-error-prs-break-downstream-slangp.md`](1785744645210-slang-capability-error-prs-break-downstream-slangp.md), [`1785747291729-a-b-testing-a-slangpy-fix-against-an-unreleased-sl.md`](1785747291729-a-b-testing-a-slangpy-fix-against-an-unreleased-sl.md).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785750679044-slang-e36121-fires-only-on-explicitly-requested-ca.md`_
