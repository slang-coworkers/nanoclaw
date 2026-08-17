---
title: "slang sibling-opcode threading — grep-not-list rule for fan-out inventory"
type: learning
topic: slang-compiler
source: learnings/1780292674603-slang-sibling-opcode-threading-grep-not-list-rule-.md
---

# slang sibling-opcode threading — grep-not-list rule for fan-out inventory

# Use `grep`, not curated lists, when inventorying touchpoints for a new sibling opcode

When threading a new IR opcode as a sibling of an existing one in Slang's autodiff (or any subsystem with similarly distributed pattern-matching), **the only reliable inventory is `grep` for the existing opcode's symbol across the codebase, followed by per-hit audit**. Curated touchpoint lists — even careful, multi-round-reviewed ones — routinely miss touchpoints. Empirically:

- **PR #10827** (original incident): the curated inventory missed `ApplyForBwdFuncType` resolver, the IR translator, IR-level remat construction, and front-end `slang-lower-to-ir.cpp:4974`. Failure mode: param-count-mismatch crash.
- **shader-slang/slang#11372 phase 1** (post-codex-round-3 amended 27-touchpoint plan): the inventory missed (a) the call-site dispatch path at `slang-check-decl.cpp:9212` + the `convertHigherOrderExprToLookup` semantic-check routing, and (b) five IR-pass-level pattern matchers in `slang-emit.cpp`, `slang-ir-autodiff-transpose.cpp`, `slang-ir-check-differentiability.cpp`, `slang-ir-inline.cpp`, `slang-ir.cpp`. Code compiled but runtime tests failed end-to-end (VM operand-out-of-bounds; "unexpected IR opcode during code emit").

The pattern across both incidents: **every site that pattern-matches the original opcode (or its name) is a touchpoint for the new sibling opcode, regardless of which layer it lives in** — AST, resolvers, IR translator, IR passes, emit-boundary classifiers, or name-lookup tables. Curated lists tend to under-cover the IR-pass and name-lookup layers.

## The grep-and-audit step

Before opening any PR that introduces a new sibling autodiff opcode (or, by analogy, any new opcode that's a variant of an existing one), run:

```bash
grep -rn "kIROp_<existing-opcode>" source/slang/ source/compiler-core/ source/core/
# also grep for the legacy variant if there is one, e.g.:
grep -rn "kIROp_LegacyBackwardDifferentiate" source/slang/ source/compiler-core/ source/core/
```

For each hit: either (i) the new opcode also belongs there (sibling-add), or (ii) there's a positive reason it doesn't (document the asymmetry inline so future readers understand it).

This is a 10-minute job. The alternative is a post-merge gap discovery — which on #11372 cost a full implementation cycle (27 touchpoints landed, tests failed, second design-call cycle to authorize the gap-resolution commit).

## Why curated lists miss

The reviewers (including codex critique passes) tend to verify "did the proposed touchpoints all get touched correctly?" — a within-list correctness check. They don't independently re-derive the list. So if the list is incomplete, the correctness check passes vacuously and the gap surfaces only at runtime. The grep-derived list is independently complete, by construction.

## Layers most often missed by curated lists

In ranked order of historical miss-rate on Slang autodiff:

1. **Name-lookup tables** (e.g. `convertHigherOrderExprToLookup`): map operator names to lookup chains; can silently route a new operator into the wrong opcode binding.
2. **IR-pass-level pattern matchers** (`slang-ir-autodiff-transpose.cpp`, `slang-ir-check-differentiability.cpp`, `slang-ir-inline.cpp`, `slang-emit.cpp`, `slang-ir.cpp` resolve-through-diff): each pass independently switches on the opcode; missing the new sibling = "code compiles, runtime breaks at this pass."
3. **Override-synthesis sites** (`slang-check-decl.cpp` synFunc->irOp assignments).
4. **Stable-name table** (`slang-ir-insts-stable-names.lua`): append-only, but easy to forget the append.

When in doubt, grep. Don't trust the list.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780292674603-slang-sibling-opcode-threading-grep-not-list-rule-.md`_
