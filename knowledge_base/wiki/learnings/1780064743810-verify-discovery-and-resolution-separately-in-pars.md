---
title: "Verify Discovery and Resolution Separately in Parser-Ambiguity Triage"
type: learning
topic: agent-ops
source: learnings/1780064743810-verify-discovery-and-resolution-separately-in-pars.md
---

# Verify Discovery and Resolution Separately in Parser-Ambiguity Triage

# When proposing a "discovery pre-pass" to fix parser ambiguities, verify the discovery step itself

When triaging a parser-ambiguity bug and considering a "two-pass / pre-scan / decl-discovery" approach, verify the **discovery step** is feasible separately from the **resolution step**. They have different failure modes and the discovery step is often where a less-obvious circularity hides.

## Trace: shader-slang/slang #11349 (May 2026)

The repro was `extension<let N: Foo<1>.a<Foo<2>.b<3>>> Bar<N>` paired with a mirror-image `extension` — cross-extension generic ambiguity where `a`/`b` are member decls of the *other* extension.

I proposed approach 3 in the initial triage: "two-pass parser — top-level decl-name scan that produces an is-generic-decl set used during the main parse to disambiguate." Maintainer (juliusikkala) pushed back: the decl-name scan itself is infeasible due to bootstrapping circularity.

They were right. The hidden circularity:
- A top-level scan to identify `Foo` and `Bar` as generic structs is fine (just look for `struct Foo<…>` syntactically).
- But this issue's ambiguity is on `Foo<1>.a<…>` and `Foo<2>.b<…>` — `a` and `b` are **member decls inside extension bodies**, not top-level.
- To classify `a` as a generic, the scan must descend into the *other* extension's body.
- To get to that body, the scan must skip past `extension<…>`'s generic-param list.
- That `<…>` contains the very same generic-vs-comparison ambiguity the scan is trying to enable. Circular.

Verified against `source/slang/slang-parser.cpp:1697` (`ParseGenericDeclImpl`): no bracket-counting infrastructure, no existing pre-scan / two-pass scaffolding to build on. A fresh pre-scan would have to introduce both a discovery mechanism *and* a skip rule — and any reliable skip rule for `<…>` in generic-param-list contexts is itself a language change.

## The general rule

When a triage proposal involves a "pre-scan that classifies things to enable downstream disambiguation," the proposal has two independent feasibility claims:

1. **Resolution is correct given the classification.** (Usually obvious.)
2. **Discovery can produce the classification without the very disambiguation it's trying to enable.** (Often where the circularity hides.)

Verify (2) by walking through the discovery pass on the actual repro before committing to the approach in a triage report. The trap is that "find all top-level decls" sounds trivially feasible, but if any of those decls have generic-param lists that themselves require the disambiguation (as is true for `extension`, `struct`, `enum`, etc. in Slang), the discovery pass is just the same problem at a different layer.

## Heuristic

If the ambiguity is on **member access** (`Outer<…>.member<…>`), a top-level decl-name scan cannot resolve it — discovery would have to reach into bodies, which requires skipping `<…>` lists, which requires the disambiguation. Either propose a language change (rules that make `<…>` reliably skippable without name knowledge) or a clearer diagnostic — not a pre-scan.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780064743810-verify-discovery-and-resolution-separately-in-pars.md`_
