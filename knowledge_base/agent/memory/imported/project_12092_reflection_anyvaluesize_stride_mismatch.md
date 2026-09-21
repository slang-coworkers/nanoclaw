---
name: project_12092_reflection_anyvaluesize_stride_mismatch
description: "slang#12092 reflection=32 vs ArrayStride=80 — DEFERRED 09-11 by jkwak: confirmed bug needing a big (non-localized) refactor; use [anyValueSize(N)] workaround until resolved. Reflection is CORRECT (external-API-contract size), BACK-END is the bug (de-facto size for buffer-stored existentials). Analysis delivered (cmt 5543984361): ONE interned lowered rep per interface ⇒ boundary uses must split BEFORE lowerExistentials. DORMANT, open, no work authorized; guard = re-engagement backstop, silence-nudge disabled"
metadata:
  node_type: memory
  type: project
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

**shader-slang/slang#12092** (RefuX, non-bot) — reflection reports the fixed default existential size (16 payload + 16 RTTI/witness = **32**) for an interface with an *inferred* `[anyValueSize]`, disagreeing with the emitted `StructuredBuffer<Interface>` element `ArrayStride` (**80** = 16 + `float4x4` 64). A tool sizing CPU-side buffer packing from reflection packs at the wrong stride, corrupting every element past the first. REPRODUCED on ToT (code-proven + reporter-measured); classified bug / medium / reflection-layout (existential types) / P2; `reproduced` label, Type=Bug.

## Current disposition — DEFERRED, dormant, no work authorized

⏸️ **DEFERRED BY MAINTAINER 2026-09-11 — jkwak-work, comment 5637624052** (to reporter): *"This appears to require a big refactoring to properly resolve. Please use a workaround by explicitly setting a big number with `[anyValueSize(N)]` until it gets resolved."* Disposition = **DEFER** (not fix-now, not won't-fix). The analysis's "non-localized refactor" conclusion was accepted; maintainer chose not to commission it now. Bug stays **open** as known/deferred; `[anyValueSize(N)]` is the interim answer for users. Fixer wire idle.

⭐ **A deferral CLOSES the active cycle without closing the issue — the correct guard for it watches for RE-ENGAGEMENT, not for silence.** Guard `i12092-scope-guard-7eb8` repurposed to a pure re-engagement backstop: silence-nudge DISABLED (deadline→2099; nudging a deliberately-deferred bug nags a settled decision), while `NEW_HUMAN_COMMENT` / state / label / assignee triggers stay live (webhook is the primary path). If a maintainer later authorizes the refactor, re-engage the fixer through the triager.

## The actual bug (Foley, tangent-vector, comment 5221466013)

**Two any-value sizes exist and are DIFFERENT BY DESIGN:** (1) the **external-API-contract size** — computable purely from AST (interface decl + `[anyValueSize]`); for `IFoo` that is 16 payload ⇒ 32 total. (2) the **de-facto size** — computable only from Slang IR at codegen from conformances in scope; here 64 (because `Big` is boxed into `IFoo`) ⇒ 80 total.

⛔ **REFLECTION IS CORRECT AND THE BACK-END IS THE BUG — the opposite of what our chain first published.** Values of existential type **stored in memory / a buffer / a resource** (`StructuredBuffer<IFoo>`, `ConstantBuffer<IFoo>`, `IFoo*`, anything crossing a binary interface) should use a layout based on the **contract** size; reflection already gets this right, the back-end wrongly uses the de-facto size. **Temporaries** (locals, params, results) correctly use the de-facto size. ⇒ the emitted `ArrayStride 80` is the defect; 32 was right. Foley affirms it is a genuine bug meriting a fix "at some point" (not a work order) and that the workaround "shouldn't excuse a compiler bug."

**Phase-ordering mechanism (verified):** reflection layout reads ONLY the AST `[anyValueSize]` attr (`slang-type-layout.cpp:5982` → default 32). Emit stride comes from a LATER IR pass `inferAnyValueSizeWhereNecessary` (`slang-ir-any-value-inference.cpp:382`, cited 419-511; scheduled `slang-emit.cpp:1567`, cited :1500) which grows the payload to the largest conformer and writes `IRAnyValueSizeDecoration`; reflection never consults that IR decoration. (DeepWiki claimed it IS propagated — WRONG; source + observed bug refute it.)

## Decisive analysis (delivered 2026-09-04, triager, comment 5543984361, at HEAD 961e4e59ee)

⭐ There is exactly **ONE lowered representation per `IRInterfaceType`**, interned + shared across buffer elements AND temporaries (`lower-dynamic-dispatch-insts.cpp:2055-2075`). So the contract-vs-de-facto choice **cannot** be made at the `lowerExistentials` site — **boundary uses must be distinguished BEFORE lowering** (two lowered forms, or an upstream tag). Two independent layout engines never reconcile: reflection (`slang-type-layout.cpp`→32) vs emit (`slang-ir-layout.cpp` on the lowered tuple→80); de-facto 64 grows at `inferAnyValueSizeWhereNecessary` only when NO explicit `[anyValueSize]`. Confirms Foley's "not a localized band-aid" prediction ⇒ fix is a non-localized refactor.

⭐ **Foley's premise refined:** nothing is *dropped* — no buffer stride is ever carried from the front-end; the emitter always recomputes from the IR type. Non-existentials coincide because their size is intrinsic; `IFoo` diverges because its size is non-intrinsic and the contract 16 is never recorded where the stride path would read it. ⇒ fix framing = **"make boundary uses resolve to the contract size,"** not "stop the drop."

**Fix shape when authorized:** boundary uses → contract size; temporaries → de-facto; split BEFORE `lowerExistentials`. Re-engages the fixer wire through the triager, maintainer-gated. (The earlier post-emit-metadata / `IBindlessResourceMetadata` plan is withdrawn, unbuilt — nobody needs to change reflection.)

## Durable lessons

- ⭐⭐ **A gate answered by one maintainer is not the gate closed, and a maintainer can invert the DIRECTION — not just approve/reject the plan.** Our chain converged hard on "reflection under-reports; expose the bigger number"; the architect's answer was "the bigger number is the bug." **Converged agreement among tiers is not evidence about the world** — all three of us were confidently on the wrong side of a by-design distinction none had named. ([[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]])
- ⭐⭐ **A maintainer-named symbol is not a verified symbol: grep it before trusting the zero.** csyonghe named `inferExistentialTypeSize` — **0 hits at HEAD and across all history** (control on the real name returned 9 commits); the real pass is `inferAnyValueSizeWhereNecessary`. Grepping his spelling returns a CLEAN ZERO that reads exactly like "the pass was deleted" — a false-absence trap. ([[feedback_a_tool_named_without_its_path_is_a_capability_claim_with_no_address]])
- ⭐⭐ **A read-only / no-code deliverable stays with the tier that can produce it — do NOT add a routing hop.** The triager kept the layout-flow analysis in its own session rather than re-dispatching to the fixer: every hop re-introduces the handoff-death that cost this chain 24 days, for zero benefit when no code is written. Fixer wire stays reserved for an *authorized* fix. ([[feedback_restart_success_is_not_a_delivered_wake]])
- ⭐⭐ **When you dispatch a deliverable, the guard must track the DELIVERABLE** (did a bot analysis post? is a live worker session on the thread?), not just the requester's activity. A guard watching the ISSUE fired on every maintainer nudge but was blind to the fixer's dispatched-but-undelivered non-delivery — the maintainer nudging is the symptom, the disease is invisible to an outward-pointing issue-guard.
- ⭐⭐ **A scheduled guard is NOT durable across a long park** (this one vanished 2–3× across week gaps); the **webhook is the reliable wake, the guard is only a SILENCE backstop** (silence emits no event, so webhooks structurally can't cover it). **Baseline a state-guard from a LIVE query, never the triggering event's payload** — I nearly re-seeded with stale count/labels from the webhook payload; the live query caught the mismatch.
- Two standing restart checks (independent — run both, report both): (1) session **COUNT** on the group before restarting (makes restart safe vs destructive); (2) **a restart's exit code is not a delivered wake** — verify a NEW inbound row in the TARGET session (`ncl sessions messages <id> --limit 5`). ([[feedback_restart_success_is_not_a_delivered_wake]])
- ⚠️ **Infra gotcha:** `ncl tasks update` returns `no live task matched` on a recurring row currently DUE / in-flight; `pause` matches it fine. Working sequence: `pause <series>` → `update --id <series> …` → `resume <series>`.
- ⚠️ Maintainer feedback on conduct: bot comments are too long — lead with the retraction, keep public comments short (2 core-architect audience).

Related: [[feedback_dont_close_open_proposals]], [[feedback_no_double_dispatch_peer_wired]], [[feedback_triage_github_posting]], [[feedback_an_inbound_row_does_not_name_its_sender]].
