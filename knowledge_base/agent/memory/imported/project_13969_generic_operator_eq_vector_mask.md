---
type: project
name: project_13969_generic_operator_eq_vector_mask
description: "#13969 (jtytgat, external, 10-28): generic vector<T,N> == binds core's scalar IComparable operator== (regression since v2023.5.2, silent wrong code, P1, frontend). Draft PR #13970 @ c3385da13 (Approach A, pr: breaking change), R1 APPROVE_WITH_NITS, scope 'Part of #13969'. PARKED on un-draft + jhelferty-nv review + maintainer label/approach choices; no timer, ready-flip pending."
---

# #13969 — generic `operator==` returns wrong `bool3`

Dated history: [[project_13969_generic_operator_eq_vector_mask_history]]. New dated entries go there, not here.
Split on 2026-11-03 to keep this record under the 16k concept cap.

## State (verified live 11-03 15:12Z)

| Item | State |
|---|---|
| Issue #13969 | Open, assigned tangent-vector, milestone "Q4 2026 (Fall)", labels `regression` + `reproduced`. The surviving tracker: jhelferty-nv closed follow-up #13971 as its duplicate (10-28 17:48Z). Holds Reproducer 2 (explicit-call residual). |
| PR #13970 | Draft, `fix/issue-13969` @ c3385da13, label `pr: breaking change`, review requested from jhelferty-nv, 0 reviews. Body: `**Scope:** Part of #13969` (no `Fixes`); Risk line names Reproducer 2 on #13969. |
| Sessions | slang-fixer `sess-1793188613462-bmd8so` (pr-mapping owner); slang-reviewer `sess-1793192670243-zcr2zy`; Main webhook sessions `dbwe49` (#13969) and `msjew9` (#13971). |
| Timers | None. supervisor-state marks it "ready-flip pending" for the weekly un-draft list. |
| Parked on | Un-draft (operator/human only), review (jhelferty-nv), and maintainer choices: keep `pr: breaking change` or not; fast-path fix vs Approach B; final scope. |

Reopens on any human comment on #13969/#13970, or on "un-draft 13970".

## Bug and fix (triager / fixer / reviewer findings)

- **Symptom:** inside `__generic<T : __BuiltinFloatingPointType> ComponentMask operator==(Component<T>, Component<T>)`,
  `a.data == b.data` (`vector<T,3>`) gives `0 0 0` instead of `0 1 0`; the non-generic overload is correct. Fails on cpu, vk, cuda.
- **Cause:** in generic `T`, `vector<T,N> == vector<T,N>` binds core's `bool operator==<T:IComparable>` (core.meta.slang:3650) and
  splats the scalar. The rank-10 component-wise overload loses because `CompareOverloadCandidates` compares conversion/witness cost
  before `OverloadRank`, and the equality decline in `convertToBuiltinArithmeticOp` (slang-check-expr.cpp:5046-5062, from #13008)
  stops the fast path catching it. `!=` has the same bug; `<`/`>=` are fine. Bisect: v2023.4.9 good, 4.10–5.1 crash/hang,
  v2023.5.2–v2026.20 wrong. Origin #3317 (`vector : IFloat`).
- **Approach A (chosen):** delete the decline (slang-check-expr.cpp +5/−17, contract comment cites #12720). B (overload ranking) has a
  wide blast radius; C (#12720/#6966 redesign) is out of scope.
- **Evidence @ c3385da13:** 8 files +352/−167; repro fails on master, passes at head (cpu/vk/cuda/HLSL); full suite 11226/11229, the
  3 fp8 CUDA failures also fail on master. R1 APPROVE_WITH_NITS, 0 bugs, all 4 nits applied, no R2.
- **Breaking surface (Risk line):** generic `vec == vec` used as a `bool` now gives E30019 (E30055 in `[Differentiable]` code);
  `?:` and `any`/`all` select per component; a user's generic vector `operator==` is bypassed. Maintainers may relabel it
  non-breaking, since it restores the ≤v2023.4.9 behaviour.
- **Residual (Reproducer 2):** explicit `operator==(a, b)` / `!=` / `<` calls on generic vectors still return a scalar `bool`; only
  Approach B fixes it. jkwak-work: "This is a known limitation and problem. We need to find the best way to transition."

## Decisions

- 10-28: the triager filed the residual as #13971 without an operator ask (a verified, deduped issue is a free GitHub write).
  Maintainers then closed it as a duplicate of #13969, and the triager folded its test into #13969 as Reproducer 2.
- 11-03 15:04Z: after 6 days' silence on the bot's scope question to tangent-vector, the scope took its no-gate default,
  `Part of #13969` (one edit to reverse). No second @-ping.
- 11-03 15:05Z: the P1 un-draft exception was used once (dashboard msg 19). Reask cap: do not ask again.

## Lessons

- Maintainers can name **opposite survivors** for a duplicate pair (jkwak-work kept #13969, tangent-vector kept #13971). Ask which
  survives, never close anything yourself, and point out that `Fixes` would auto-close the survivor while a residual is still broken.
- A bot-filed `issue_opened` from this chain's own triager is rung 0 of the ownership ladder: dispatch nothing.
- A fixer report can land on a different Main session from the one that dispatched it (`msjew9`, not `vbq9iw`); whichever session
  receives it confirms completion.
- When a fix deletes a test that asserted the bug (here the gh-12458 decline test), its cases move into the new repro and the
  review is told.
