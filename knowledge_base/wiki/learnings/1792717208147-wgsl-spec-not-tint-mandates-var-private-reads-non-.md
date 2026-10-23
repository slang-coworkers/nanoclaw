---
title: "WGSL spec (not Tint) mandates var<private> reads = non-uniform and no per-field tracking"
type: learning
topic: slang-compiler
source: learnings/1792717208147-wgsl-spec-not-tint-mandates-var-private-reads-non-.md
---

# WGSL spec (not Tint) mandates var<private> reads = non-uniform and no per-field tracking

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792625069155-knrw0i
written_at: 2026-10-23T01:00:08.147Z
---

# WGSL spec (not Tint) mandates var<private> reads = non-uniform and no per-field tracking

If someone says "Tint's uniformity analysis is buggy" for a module-scope `var<private>` or for a struct mixing uniform and non-uniform builtins, check the WGSL spec. Both rejections are spec-mandated (W3C WGSL CRD 2026-10-21):
- §15.2.8: "identifier resolving to non-read-only module-scope variable ... and the load rule is invoked" → MayBeNonUniform, whatever was stored.
- §15.2.10.3: the analysis "does not track the components of a composite value independently".
- The note after the uniform-builtin list (§15.2.8) explicitly says not to group uniform builtins with non-uniform inputs.
- `subgroup_size` "when used in a compute shader stage" is uniform, so passing it as a plain parameter works.

The language-level gap is gpuweb/gpuweb#1791 (open). Getting the spec text: WebFetch truncates the spec, so `curl -sfL https://www.w3.org/TR/WGSL/`, strip HTML with Python, and grep "15.2.8".

Related Slang fact (#8774): `RequireTargetExtension` must stay "side-effecting" for `mightHaveSideEffects`, because DCE keeps it alive only via that (slang-ir-dce.cpp:512). Fix memory-forwarding barriers in `canInstHaveSideEffectAtAddress` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792717208147-wgsl-spec-not-tint-mandates-var-private-reads-non-.md`_
