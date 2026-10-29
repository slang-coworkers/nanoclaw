---
type: project
name: project_13973_builtin_call_constant_fold
description: "slang#13973 (andy-slater, external, 10-28): max/min/abs/clamp on compile-time constants are not constant-folded (E39999 in array size / numthreads). Draft PR #13975 @a5ec653 (Approach A: [__constantFoldAs(op)] + Min/Max/Abs/Clamp BuiltinOperationKinds) PARKED 17:38Z on maintainer language design (jhelferty-nv per tangent-vector). Fan-out drafts #13984 (#13978), #13988 (#13983), #13991 (#13986), #13993 (#13985), all parked on maintainer review since 22:41Z; #13989/#13990/#13994 filed-only. 4 operator decisions pending. Timer recheck-13975-design-1ff4 11-04 14:00Z. Dated log in _history."
---

# slang#13973: built-in calls on compile-time constants are not folded

Dated log (ids, heads, review files, every forward): [[project_13973_builtin_call_constant_fold_history]].
Fan-out records: [[project_13983_abs_unsigned_spirv_llvm_identity]], [[project_13985_uint64_loop_trip_count_signed]],
[[project_13986_int64_min_div_neg1_sigfpe]]. Human-owned overlap: [[project_13954_int_constant_fold_no_narrowing]].
New dated entries go in the history page, not here.

## The bug and the chosen fix

`int arr[max(A, B) + 2];` with `static const int` operands gives E39999 + E30071; so do `min`, `abs`, `clamp`,
`[numthreads(max(A,B),1,1)]` and a used `static const N = max(..)`. `?:` and arithmetic fold. All targets.
Cause (triager; Main verified slang-check-expr.cpp:2490-2496 @3218a7612): `tryConstantFoldExpr` returns early for a
callee with no `IntrinsicOpModifier`, and these are core-module functions with bodies (no `kIROp_Max`).
Related: #8235 (swizzle gap, open), #12651 (unary `+` fold, the precedent), #4236 (user constexpr, closed).

**Approach A** (PR #13975): an opt-in `[__constantFoldAs(op)]` marker on the scalar `__BuiltinIntegerType`
overloads plus appended `BuiltinOperationKind` Min/Max/Abs/Clamp; signedness comes from the result type.
Rejected: B, name-based dispatch (hard-codes names); C, general compile-time evaluation of pure functions (a redesign).
`abs` of an unsigned value is left unfolded, because backends disagree (#13983).

## Current state (10-28 22:41Z, checked live)

| Issue | Draft PR @ head | Fixer | Shepherd | Parked on |
|---|---|---|---|---|
| #13973 | #13975 @a5ec653 | `3rjtzd` | jhelferty-nv | language design (tangent-vector, assignee); R1 recorded, not applied |
| #13978 uint64 signed compare | #13984 @4c9091e | `3s6rec` | skiminki-nv | maintainer review + human un-draft |
| #13983 `abs(uint)` → SAbs | #13988 @7d7bbe5 | `tzhs3g` | jkwak-work | maintainer review + un-draft |
| #13986 INT64_MIN / -1 SIGFPE | #13991 @497b797 | `6cxhqb` | jhelferty-nv | review; after #13984 lands: rebase, apply `unified-on-merge.patch`, R2 on the delta |
| #13985 uint64 loop trip count | #13993 @963a7b0 | `80nd8r` | jkwak-work | #13984 + #13954 + review |

Main session `sess-1793201570113-2tdabv`; triager `79rk2o`; #13975 reviewer `walgpl`. Each follow-up runs on its
own `gh-issue-shader-slang/slang-<n>` thread.
**Filed-only (Main's hold, no fixer chain):** #13989 (cpu/cuda 8/16-bit `abs` does not compile), #13990
(`abs(INT_MIN)` UB on CUDA/CPU/LLVM), #13994 (SPIRV-Tools CCP SIGFPE on vector int64 INT64_MIN / -1; `-O0` avoids it).
**Merge order:** #13984 → #13991 → #13993 (#13993 also needs #13954). #13975 conflicts with #13984 (duplicate
`_tryConvertIntegerValueToBaseType`) and overlaps #13988 on the `abs` overloads; whichever lands second rebases.
**Timer:** one-shot `recheck-13975-design-1ff4`, 11-04 14:00Z. It covers all of the above, plus whether
`external/spirv-tools` has moved off b8c3b64b.

## Pending decisions

Operator (on the dashboard): (1) a use-case post on #13973; (2) release #13989/#13990 to fixer chains; (3) ask
jkwak-work to let the bot take #13954 (narrowing + signed `>>`). The reviewer's +37 producer prototype fixes every
shape. #13993's B1 (wrong `bwd_diff` in `[Differentiable]` loops) raises the stakes. (4) File #13994 upstream on
SPIRV-Tools and/or bump the submodule.
Maintainer: does E30510 for differentiable loops above INT32_MAX make #13993 `pr: breaking change`?

**#13975 R1, to apply only if Approach A survives:** M1 bump `k_min/k_maxSupportedModuleVersion` 37→38
(slang-ir.h:2254; the new AST class shifts serialized `ASTNodeType` tags; precedent #13406); G1 operand-conversion test;
G2 GLSL-input test; G3 Risk line (generic `max(K,1ull)` = #13978; spec-constant `max(FOO,1)` E99999 matches master's
`FOO+1`); G4 diagnose `[__constantFoldAs(99)]`; N1–N4. `remedy-r1.patch` is with the fixer.

## Decisions and lessons

- A maintainer deferral ("understand the long-term language design first") is a gate, not a grant or a refusal
  ([[feedback_reopen_not_release_parked_feature]]). Keep the PR a draft and push nothing; record review rounds and apply none of them.
  Main posts nothing on a maintainer-held design item (precedent #13971).
- **Fan-out control.** With 4 bot PRs already in flight for one chain's shepherds, Main held the lower-severity finds
  (a loud compile error, an edge-case UB) as filed-only. Silent miscompiles and crashes got chains.
- Standing rule given to the triager: filing a verified, deduped bug needs no Main go-ahead; fan-out to the fixer is
  still reported.
- **Human-owned overlap (#13954, jkwak-work):** cite it as a partial overlap or a merge prerequisite (the backlink
  is enough). Never comment on it, never say "fixes", and never take it without the operator. The reviewer's request
  to comment there was declined.
- An external-repo filing (upstream SPIRV-Tools) is the operator's call. File a Slang tracking issue only, with no
  links to the other repo ([[feedback_no_gratuitous_cross_repo_links.md]]).
- A reviewer's "Maintainer direction: none" goes stale when a maintainer comment lands mid-review; correct the reviewer.
- A `send_message` that fails with `database is locked` writes no row; re-send it.
