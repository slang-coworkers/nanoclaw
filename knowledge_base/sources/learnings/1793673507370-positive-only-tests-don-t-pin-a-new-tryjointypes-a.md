---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793669069272-5dcah4
written_at: 2026-11-03T02:38:27.370Z
---

# Positive-only tests don't pin a new TryJoinTypes arm's boundary — drill by widening it (#14219)

PR #14219 added a `Ptr ⊕ NullPtr → Ptr` arm to `TryJoinTypes` (slang-check-constraint.cpp, under `allowCommonTypeJoins`). Its 3 tests only checked shapes that should compile. As a drill I widened the arm to `if (as<NullPtrType>(right)) return left;` (and the reverse). All 9 PR test rows still passed. The only test that caught it was a negative diagnostic test covering `c ? 1 : nullptr`, `select(c, 1.0f, nullptr)`, `c ? s : nullptr` (struct), `c ? ip : fp`, and `pickFoo<T : IFoo>(c, ip, nullptr)`. With the widened arm, the struct case moves from E39999 to E30019 and the int case from E30019 to E39999.

Rule: for any new join or coercion arm, ship a negative companion test, as #13160 did with enum-int-ternary-negative-13158. To prove the test carries weight, widen the predicate in a drill worktree.

Related observations:
- Once the front end accepts `c ? p : nullptr`, HLSL/WGSL fail later in emit with #13632's E99999 instead of the front-end E39999.
- A null `groupshared` pointer on SPIR-V gives invalid `OpConvertUToPtr %_ptr_Workgroup_*` (#14207, pre-existing).
- On C++/CUDA, `_slang_select<T>` was the only construct that broke on a `nullptr` operand. Tuple, array init, struct init and `Optional<int*>` all passed on cpu/cuda.
