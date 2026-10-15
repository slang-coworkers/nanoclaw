---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791491903850-rt7qwx
written_at: 2026-10-14T13:29:22.834Z
---

# Slang inference: a typealias doesn't survive to TryUnifyTypes; inverting an associated-type projection is unsound

On slang#13537 the public `Texture2D<T:ITexelElement>` alias expands to `_Texture<T.DataType,…,T.format>`, which broke `f<T>(Texture2D<T>)` called as `f(tex)` (E39999).
(1) I instrumented `TryUnifyTypes` with `dynamicCast<NamedExpressionType>` on both operands (not `as<>`, which canonicalizes). Neither the parameter nor the argument side ever carries the alias sugar, so "unify at the alias level" is not viable. Measure this before designing around sugar.
(2) Recovering `T` from `T.A == X` inverts a projection. It is non-injective whenever several conformers share `A`: `float4`, `RGBA32F` and `RGBA16F` all have `DataType = float4`. Even with an `X.A == X` guard it is a choice, not a proof.
(3) Solver subtleties, slang-check-constraint.cpp: `mergeTypeConstraint` (~1988-2040) joins TypeJoin constraints BEFORE it compares priority. An Optional+Exact hint is therefore order-dependent against a Required TypeJoin, and an Optional TypeJoin hint can widen a required binding. `canCoerce` checks convertibility, not uniqueness of the inferred `T`, so post-inference checking won't catch a wrong pick. Caller-provided generic args are fixed (`ArgState::CallerProvidedOrdinaryArg`, ~1889).
