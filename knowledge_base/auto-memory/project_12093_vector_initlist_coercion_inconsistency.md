---
name: project_12093_vector_initlist_coercion_inconsistency
description: "slang#12093 vector init-list scalar-splat vs tail-pad inconsistency — PARKED design-gated, awaiting maintainer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 855ca28d-867b-4fa2-8862-f10a887c6efe
---

shader-slang/slang#12093 — `int4 v={1,int2(2,3)}` → `{1,1,2,3}` (scalar `1` splatted to `int2(1,1)`) vs `int4 v={1,2,3}` → `{1,2,3,0}` (tail-pad-by-0). Two init-list paths, two behaviors.

**Author:** skiminki-nv (maintainer, asking a *semantics* question — same person owns umbrella #12046). frontend / semantic checker / P2 / medium.

**Root cause (triager-proven, ToT @65a98e333, CPU interpreter):** `vector<T,4>` is a core-module struct with explicit composition ctors (core.meta.slang:2777-2805) incl. `__init(vec2,vec2)` but NO 3-arg ctor. `_coerceInitializerList` (slang-check-conversion.cpp:1403) tries ctor overload resolution FIRST; falls to legacy tail-pad reader (:998) only when no ctor matches. `{1,2,3}` (3 args, no 3-arg ctor) → legacy → tail-pad. `{1,int2}` (2 args) → matches `(vec2,vec2)` → scalar splat of the `1`.

**State: AUTHORIZED 07-14 → fixer dispatched via triager.** skiminki-nv gave explicit build order (comment 4970031042: "Let's try this. Please prepare a PR.") — released the park. Scope = Approach A: add `__init(T,T,T)`, `__init(vec2,T)`, `__init(T,vec2)` to `vector<T,4>` with **defined bodies tail-padding 4th to T(0)** (not plain MakeVector intrinsics). Keep existing ctors intact; do NOT touch "should tail-pad exist at all" (skiminki deferred as too risky). CPU-interpreter regression test all 3 shapes. Guardrail: PR stays DRAFT unless maintainer flips ready; "prepare a PR" ≠ ready/merge. Approaches were: A=exact-arity ctors (chosen), B=component-count flatten, C=disallow under-fill.

**07-14 maintainer reply (skiminki-nv, comment 4968590617, @-mention → posting authorized):** proposes workaround = add 3-element ctors to `vector<T,4>` (`__init(T,T,T)`, `(vec2,T)`, `(T,vec2)`); says language-level fix is backward-compat risky. This REOPENED discussion, NOT a build authorization ("I would likely try" = hedge). Still parked.

**Triager verified read (empirical on HEAD binary):** his mechanism is SOUND and maps to Approach A. `vector<T,3>` ALREADY ships these ctor shapes (core.meta.slang:2764-2776) and vec3 is consistent today (`int3 {1,int2(2,3)}`→`{1,2,3}`, no splat) — proves exact-arity ctor (cost 0) out-resolves scalar→vector splat (cost 2). Adding same to vec4 → `{1,2,3,0}`; also fixes ambiguous `int4(1,2,3)`; no regression (`{int2,int2}`→`{1,2,3,4}` still works). **Arity flag CONFIRMED (my catch):** his 1+2=3 components < 4, so the new signatures can't be plain `MakeVector` intrinsics — need defined bodies tail-padding the 4th to 0 (e.g. `__init(T x, vec2 yz){ this = vec4(x,yz.x,yz.y,T(0)); }`). Real (small) change, not copy-paste from vec3. Fixes the *inconsistency*, NOT his deeper "should tail-pad exist at all" question (he defers that as too risky). Triager flagged this to him.

**GitHub:** 5-bullet posted (comment 4968204563); reply to maintainer posted (comment 4968722291, fresh delta — bot was last commenter); `reproduced` label; Type untouched.

**Next human action:** maintainer gives explicit go/no-go. On go: targeted backward-compat core-module ctor additions to vec4 + CPU regression test; re-engage triager→fixer on canonical thread `gh-issue-shader-slang/slang-12093`. Relates to [[feedback_triage_github_posting]], [[feedback_reopen_not_release_parked_feature]], [[feedback_dont_close_open_proposals]].
