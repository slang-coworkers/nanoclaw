---
name: PENDING maintainer design call — #10027 vector<T,4> import abort
description: shader-slang/slang#10027 PARKED / maintainer-deferred ~2 sprints (2026-07-17); 4 durable diagnosis artifacts posted; fix HELD as maintainer-domain pending convergence on the earliest generic-app canonicalization point
type: project
originSessionId: 881df667-5ce9-415e-8be7-10cdc2de6df5
---

# #10027 — `vector<T,4>` precompiled→import abort (PARKED, maintainer-deferred)

**Bug.** A `static const int4` (any `vector<T,4>`) declared in a module precompiled to `.slang-module`, then accessed from another module via `import`, aborts the importer with `InternalError: … Generic type/value shouldn't be handled here!`. `int3`/`vector<T,3>` compiles clean; single-file round-trip does NOT repro — the serialize→import boundary is required.

## Root cause (as finally reconciled — producer-layer is authoritative)

The failing `Var`'s deserialized element type comes back as bare `T` for int4 (vs concrete `Int` + `ConstantIntVal(3)` for int3), so lowering the bare `T` hits the generic-param guard and aborts. The **producer-layer** mechanism (jkwak's framing, which the fixer accepted as correct): the imported init should bind `__init(…)` of `__extension vector<T,4>`, but the ref loses the `T:=Int` substitution across the round-trip **because `4` is `struct vector`'s default `N`** (`core.meta.slang` ~L2272). The IR-lowering abort is only the *symptom* end; "dropped `T:=int` substitution" describes the symptom, not the fix site.

- csyonghe's **directional steer** (the current release-gating question): it is wrong to form a representation for `vector<int>` (partial/default-N generic app) at all — *canonicalize generic apps to `vector` as early as possible*. Q1 = why is `vector<int>` formed / where; Q2 = earliest canonicalization point.
- Q1 answer (fixer): there are **three distinct incomplete-`vector` shapes** with different producers — (a) bare `vector`-as-type (0 args) via `getGenericDeclRefType`; (b) explicit one-arg `vector<int>` via `PartiallyAppliedGenericExpr` / `getGenericAppDeclRef`; (c) canonical `vector<int,4>` via `getVectorType` (always fully applied). Default-N fill is the *consumer* `CoerceToProperTypeImpl`, which receives the partial form, doesn't produce it. Which shape the failing `Var` carries is INFERENCE (no runtime dump).
- Q2 answer (proposal, layer choice deferred to maintainers): canonicalize at the producer/intern boundaries (`getGenericDeclRefType` + `getGenericAppDeclRef`) so no non-canonical `vector` Val is ever hash-consed; fallback = tighten the `CoerceToProperTypeImpl` rebuild (smaller, still earlier than the two earlier downstream candidates C1=canonicalize upstream of the mangle fork, C2=deserialize rebuild). Consumer-end guards ruled out as masking (no-mask methodology; codex concurred).

⚠️ **Anchors drift ~every few commits** (this chain re-pinned them repeatedly: identity check `tryGetGenericArguments` moved :818→:830; IR-lowering guard :14739→:14777→:14797). Do NOT trust frozen line numbers — re-pin every anchor via `git show origin/master:<file>` at current master before quoting.

## Durable GitHub artifacts (the diagnosis lives on GitHub, verified on-thread)

- Corrected root-cause verdict — [comment 4732730516](https://github.com/shader-slang/slang/issues/10027#issuecomment-4732730516).
- Initial int4-vs-int3 code-path trace — comment 4930753905 (answers csyonghe's 3 Qs).
- Reconciliation reply (jkwak refines/corrects the layer) — comment 4985792817.
- Mermaid flowchart of the flow + candidate fix points — comment 4989222313.
- Q1/Q2 origin trace + earliest-canon proposal — comment 4999777695.

## Chain state = PARKED / MAINTAINER-DEFERRED (~2 sprints, as of 2026-07-17)

jkwak deferred the issue by two sprints ([comment 5007401601](https://github.com/shader-slang/slang/issues/10027#issuecomment-5007401601)) — a scheduling decision, not a design input. **Fix HELD** (maintainer-domain, high blast radius: synthesized-ctor synthesis and/or module-AST serialization).

- **Release trigger:** maintainers converge on the *earliest* generic-app canonicalization point (no longer merely "pick candidate C1 vs C2"). Not expected before the deferral window closes.
- **Do NOT nudge** — jkwak self-committed to returning; two-sprint deferral = explicitly don't chase. Re-opens via webhook on canonical thread `gh-issue-shader-slang/slang-10027` on a maintainer's next substantive comment ([[feedback_reopen_not_release_parked_feature]]).
- **How to resume:** always dispatch on the clean append-only sub-thread `…/diag-retry` (NOT the original canonical-thread fixer session — its context DB persisted a context-compaction thrash; re-waking it re-thrashes). Anti-thrash guardrails: no full-log/IR-dump inline reads — grep + chunks + subagents. Re-verify int4/int3 + report SHA. Any GitHub reply is DIAGNOSIS/DESIGN ONLY; posting a verified diagnosis is operator-authorized ([[feedback_triage_github_posting]] / [[feedback_github_writes_operator_authorized]]) — only ready-flip + merge are gated. A 2-file precompiled-module regression test is designed/ready to land with the fix.

## Durable lessons carried out of this chain

- **Verify before relay** — a prior turn fabricated a "trace posted at HEAD X" claim (retracted); never relay a downstream "posted / re-verified" claim until a real comment URL is confirmable on GitHub (cf. [[project_11982_debugsource_dup_import]] fabricated-PR pattern).
- **Context-compaction thrash** (the original fixer session): root cause = oversized inline reads (full logs / IR dumps). A finished build + on-disk worktree lets a clean-context session resume without rebuild. There is no safe surgical per-session host restart — `ncl groups restart --id <group>` hits the whole coworker group (collateral across all its in-flight chains); `ncl sessions …` is read-only. A stray `ncl groups restart help` probe once fired a real pending group-restart approval — approvals route to the operator and can't be cancelled from here.
- GraphQL 401 flapping can drop the `[bot]` suffix on a REST-posted comment; writes still land via REST ([[project_github_actions_graphql_401_outage]]).
