---
title: "slang#12139 — resolving a two-commit perf confound by workload trigger-path (#12106 memo vs #12052 -specialize)"
type: learning
topic: slang-compiler
source: learnings/1784270455318-slang-12139-resolving-a-two-commit-perf-confound-b.md
---

# slang#12139 — resolving a two-commit perf confound by workload trigger-path (#12106 memo vs #12052 -specialize)

## Context
shader-slang/slang#12139: jvepsalainen-nv reported a broad ~10-15% flat front-end compile-time regression on
SHALLOW generic/checking code after PR #12106 ("Memoize shared Val and type DAG traversals", commit c8d02ae59,
merged 2026-07-16). #12106 killed #12100's exponential deep-generic times but taxed shallow one-shot traversals.
Cost concentrates in SemanticChecking (+8..+48% own) and apiLoadModule (+14..+18% own). Reporter flagged that
`interface_depth`'s +40.1% outlier was "not separable from this data" because the cited commit window
(c5d4d76e6..6c837d317) ALSO contains PR #12052 (89443da36, extension-conformance visibility for `-specialize`d
generic entry points), which touches inheritance/conformance paths.

## The mechanism (verified @HEAD 5c30d437f, source/slang/slang-ast-substitution.h)
`SubstitutionCache` (:16-60) = `Dictionary<Key,Result>`, Key={Val*, packExpansionIndex}. The wrapper
`substituteValWithCache` (:66-96): the FIRST substituteImpl on the stack heap-constructs a fresh cache per
top-level substitution op (:74-79); every node does a hash `tryGet` (:85) + on-miss a SECOND hash `add` (:93).
On a TREE (each Val visited once) the cache is 100% miss → pure overhead (per-op Dictionary alloc + 2 hashes +
wasted insert per node). On a SHARED DAG (inner type recurs as generic-arg AND conformance-witness — the #12100
shape) it converts exponential tree-traversal to linear. Reviewer audits confirmed the memo is
SEMANTICS-PRESERVING (ioDiff delta on hit == re-dispatch diff), so gating/shrinking the cache is ALWAYS
correctness-safe — pure speed/space trade.

## How I resolved the confound WITHOUT the perf data (the reusable technique)
Read `tools/compile-perf/lib/manifest.py`. All three heavy sema workloads — `interface_depth`,
`generic_nesting`, `generic_nesting_eval` — use `mode="module"` (single-file → .slang-module compile). ONLY
`rt_renderer_specialize` and `api_specialize` use `IEntryPoint::specialize`, which is the SOLE path #12052's
`EntryPoint::_validateSpecializationArgsImpl()` (slang-check-shader.cpp:3419-3462) touches. Therefore **#12052
cannot own the `interface_depth` outlier** — that workload never triggers `-specialize`. The outlier lands in
SemanticChecking during MODULE compilation = #12106's territory (interface_depth scales calcInheritanceInfo, an
inheritance-witness DAG the substitution memo traverses).

**Lesson:** a perf confound that "can't be separated from the aggregate data" is often separable by CODE-PATH
analysis — find which benchmark workloads actually trigger each suspect commit's changed function. A commit
gated behind a rarely-used entry (here `-specialize`) can't tax workloads that never hit it, regardless of what
the aggregate deltas suggest. Check the workload's invocation mode, not just its name/shape.

## Fix direction (all preserve the #12100 win, all correctness-safe)
B (recommended): small inline-buffer cache, promote to Dictionary past a threshold — shallow pays cheap pointer
compares + zero heap; deep DAGs promote. C: pool/reuse the cache Dictionary across ops (ASTBuilder-owned scratch
stack, clear() retaining capacity) — kills allocator churn. A: work-based guard (NOT static-depth — static depth
risks re-introducing #12100 on a shallow-looking heavily-shared DAG). Revert = rejected (re-breaks #12100).
STRONGLY profile first to rank {per-op alloc vs double-hash vs wasted insert}. Likely owner = #12106 author
saipraveenb25 / perf team. Slang's `Dictionary` has `tryGetValueOrAdd`/`getOrAddValue` (slang-dictionary.h:259-282)
to collapse the double-hash cheaply as an independent micro-win.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784270455318-slang-12139-resolving-a-two-commit-perf-confound-b.md`_
