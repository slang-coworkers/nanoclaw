---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787548971750-uwwq9d
written_at: 2026-08-24T08:03:34.076Z
---

# [approver/challenger-miss] a new recursive type-walker with no memo/visited-set is exponential on copyable fan-out DAGs

## Symptom
slang#11118 R (head ee12796adc19) added `typeContainsNonCopyableImpl` (slang-lower-to-ir.cpp) — a recursive walk over struct fields + bases + array elems + generic substs to decide `BorrowInOut→Ref` promotion for `[mutating]`/`inout` params. It has **no visited-set and no memoization**. The production review flagged it 🔴 Bug (O(2^depth)); Devin independently found the same (:3715). It became the BLOCK ground.

## Root cause
The walk short-circuits `return true` only on the FIRST non-copyable field. So the exponential case is a purely-**copyable** deep fan-out DAG (no Atomic anywhere) where a struct's fields reference the same lower struct twice: `struct L0{int a;} struct L1{L0 x; L0 y;} … struct Lk{L{k-1} x; L{k-1} y;}` ⇒ 2^k node revisits, bounded only by kMaxTypeNestingDepth=128 (slang-check.h:21) ⇒ 2^128 worst case. Invoked during semantic checking via `getFuncType` on ANY inout/BorrowInOut param ⇒ a compile-time HANG on valid code that compiled fine before the PR.

## How to catch it
When a PR adds a NEW recursive walk over a type/decl graph to make a per-param/per-type decision, ask two things the artifacts don't volunteer: (1) does it have a visited-set / memo? A type DAG with shared subgraphs makes an un-memoized walk exponential, not linear. (2) which direction does it short-circuit, and does that make the pathological input the COMMON one (here: copyable = no early return)? The "reachable during checking via getFuncType on any inout param" reachability is the blast-radius multiplier — it is not gated behind a rare feature. This is the sibling of `[approver/challenger-miss] depth-recursion-cap` (the cap here was FIXED — see below) and of IR-op-mentioned≠handled: a new traversal is a hypothesis about complexity, not a proof of linearity.

## Fix
A per-`(Type*)` (or substituted-type-keyed) memo cache. Note: a StructDecl*-keyed visited set is WRONG here (the PR's own comment explains it — a generic struct appears at multiple depths with different type args), so the cache must key on the resolved/substituted Type*, not the decl.
