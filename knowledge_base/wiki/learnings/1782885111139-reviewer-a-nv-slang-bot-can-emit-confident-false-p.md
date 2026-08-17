---
title: "Reviewer A (nv-slang-bot) can emit confident false-positive crash bugs whose repros do not compile — always compile the repro"
type: learning
topic: review-process
source: learnings/1782885111139-reviewer-a-nv-slang-bot-can-emit-confident-false-p.md
---

# Reviewer A (nv-slang-bot) can emit confident false-positive crash bugs whose repros do not compile — always compile the repro

On shader-slang/slang#11873 (vk::binding on resource-containing struct entry-point params), the correctness reviewer (nv-slang-bot / claude-pr-review pipeline, "Reviewer A") produced a confident **🔴 stack-overflow bug** with a detailed, plausible code trace (cited slang-ir-check-recursion.cpp, exact line numbers, sibling-guard comparison). It was a **false positive**: its two repros don't compile. Its top 🟡 gap was also a false positive.

**Rule:** For any reviewer finding that claims a crash / infinite recursion / spurious diagnostic, **compile the exact repro against a built slangc before treating it as blocking.** Automated reviewers reason from source and miss that front-end guards reject the input earlier. A confident code trace is not proof the input is reachable.

**Why (the guards that pre-empt the predicate in `isVkBindingCompatibleEntryPointParameterType`, verified by compilation on slangc 2026.10.2):**
- Value-recursive struct `struct S { S next; }` as a `uniform` entry param → **fatal E39997 "maximum type nesting level exceeded"** (front-end; by-value field nesting is bounded at `kMaxTypeNestingDepth = 128` by decl/param-setup walks like `_collectExistentialSpecializationParamsRec` and default-ctor synthesis) — halts BEFORE `validateEntryPoint` runs the predicate. The generic variant `struct Wrap<T> { Wrap<vector<T,2>> next; ... }` → also E39997 (so the "distinct Type* per level defeats a seenTypes-only guard" argument is moot — the input never reaches the predicate).
- Same struct as a **global** (not an entry param) → **E41001** (late IR pass) — but a global isn't an entry param, so the predicate never runs on it. This is the case the reviewer generalized from incorrectly.
- Cyclic inheritance `struct A:B; struct B:A;` → **fatal E39999 "cyclic reference in inheritance graph"** → base chain is always acyclic/finite.
- Interface-first-then-struct-base `struct D : IFoo, Base` → **error E30820 "a struct type may only inherit from one other struct type, and that type must appear first"**. So `findBaseStructType`'s `getFirstOrNull()` is correct by construction — the struct base is guaranteed first. (The reviewer's cited counter-example `Impl2 : IFoo, IFoo2` is two interfaces, not a struct-base-after-interface.)

**How to apply:** When coordinating the /slang-pr-review 3-reviewer merge, don't pass A's verdict through verbatim. Add a coordinator verification addendum for any 🔴/high-🟡, compiled-repro-backed. Reviewer C (clarity) correctly DROPPED the same termination concern here (its instinct beat A), though C's stated mechanism ("infinite size, rejected during type checking") was imprecise — the real guard is the E39997 depth limit. Reviewer B (Devin) reported 0 findings and echoed the PR body (consistent with prior learnings on this vk-binding file family — weak signal).

Net: PR #11873's struct-recursion fix was correct; the only real feedback was test coverage (add a generic-struct-field test for the claimed `getType` substitution path) + a clarity comment. Verdict: APPROVE_WITH_NITS.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782885111139-reviewer-a-nv-slang-bot-can-emit-confident-false-p.md`_
