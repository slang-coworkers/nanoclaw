---
title: "DeepWiki can hallucinate API symbols — grep the real header before citing"
type: learning
topic: ci-tooling
source: learnings/1785836147443-deepwiki-can-hallucinate-api-symbols-grep-the-real.md
---

# DeepWiki can hallucinate API symbols — grep the real header before citing

## Rule

Treat `mcp__deepwiki__ask_question` output as a **lead, not a citation**. Before putting any API name, flag, or line number into a user-facing answer, verify it against the actual file on master:

```bash
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy SSL_CERT_FILE NODE_EXTRA_CA_CERTS
curl -sf "https://raw.githubusercontent.com/shader-slang/slang/master/include/slang.h" -o /tmp/slang.h
grep -n "getEntryPointHash\|isBinaryModuleUpToDate\|precompileForTarget" /tmp/slang.h
```

## Why — a concrete miss (2026-08-04)

Asked DeepWiki about Slang shader-compile caching. Its answer was ~90% accurate and genuinely useful, and it even flagged one gap itself. But among the symbols in play, **`precompileForTargetAndLink` does not exist** in `include/slang.h`. The real API surface is:

- `IComponentType::getEntryPointHash` — `include/slang.h:5441` (its own doc comment says the hash is "used as a key for caching the output of the compiler backend to implement shader caching" — this is the `vkPipelineCache` analogue)
- `IModulePrecompileService_Experimental` — `:5679`, with `precompileForTarget` `:5695` and `getPrecompiledTargetCode` `:5697` (experimental; mutates the module; not thread-safe)
- `ISession::isBinaryModuleUpToDate` — `:4654` (caveat in the comment directly above it: for precompiled-only/standalone artifacts the compiler-version and option-set hash are **not** compared)

Had I drafted straight from the DeepWiki reply, a non-existent function would have gone to a user as a verified-sounding claim with a fake citation. That's exactly the failure the "read the actual source before describing code" invariant exists to prevent — and RAG-style tools make it *easier* to trip, because the output reads as sourced.

## Bonus: the same check pays off for CLI flags

Verifying a user's own guess is cheap and worth doing. `-fvk-use-c-layout` is real (`source/slang/slang-options.cpp:854`), and greping around it surfaced the full family plus the two layers a DeepWiki summary hadn't cleanly separated:

- Flags: `-fvk-use-scalar-layout`/`-force-glsl-scalar-layout` `:844`, `-fvk-use-dx-layout` `:850`, `-fvk-use-c-layout` `:854`, `-fvk-use-gl-layout` `:895`
- API equivalents (`include/slang.h`): `ForceCLayout = 129` `:1209`, `GLSLForceScalarLayout = 55` `:1097`, `VulkanUseGLLayout = 53` `:1094`
- Per-type generics (`source/slang/hlsl.meta.slang`): `DefaultDataLayout` :31, `Std140DataLayout` :45, `Std430DataLayout` :54, `CDataLayout` :70 — usable as `ConstantBuffer<T, CDataLayout>`

Grabbing the raw file once and greping it costs ~10s, gives exact line numbers to cite, and turns a plausible answer into a checkable one.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785836147443-deepwiki-can-hallucinate-api-symbols-grep-the-real.md`_
