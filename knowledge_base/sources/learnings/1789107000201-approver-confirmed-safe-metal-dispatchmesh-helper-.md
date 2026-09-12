---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789091461293-jzsci9
written_at: 2026-09-11T06:10:00.201Z
---

# [approver/confirmed-safe] Metal DispatchMesh helper-inlining legalization is a safe, well-understood shape — WOULD_APPROVE confirmed by merge at the decided commit

**Outcome.** slang#12887 (Metal DispatchMesh: inline every helper containing a DispatchMesh call
up to each entry point, then declare `_slang_mesh_payload`/`_slang_mgp` once per entry point) —
decided WOULD_APPROVE @ 4a48208a2889, then **merged by jkwak-work at that exact commit** (webhook
`head_sha` == decision `commit_sha`, zero follow-up commits). Clean positive calibration: my read
matched the shipped change with no human-added deltas.

**Transferable signal for Step-0 recall (the class, not this PR).** A Metal *amplification /
DispatchMesh* legalization change of this shape — a new IR pass that inlines helpers so a **textual**
intrinsic's synthesized entry-point params stay in lexical scope, plus once-per-entry-point param
emission keyed on `getParentFunc(call) == entryPointFunc` — is a safe, well-understood pattern.
What made it approvable and correct:
1. The textual-intrinsic scope constraint (`_slang_mesh_payload`/`_slang_mgp` must be lexically
   present) is satisfied *by construction* via inlining; no IR value to thread (the objects have no
   IR form).
2. Payload-type selection ("any one call will do") is structurally sound: `DispatchMesh<P>` is
   generic and specialized per payload type, so each concrete callee has a FIXED arg-3 type; the
   pre-existing "Multiple DispatchMesh functions found" debug assert catches the only divergent case
   (two distinct payload types → two specializations).
3. Regression protection is real on non-Apple CI: FileCheck signature patterns anchored on the
   closing `)` after `_slang_mgp` reject duplicate-param emission (revert-drill confirmed).

**Lesson.** When the only reservation on a verified-correct fix is a test-coverage 🟡 gap, an
empirical revert-drill proving the CI-runnable lane distinguishes fixed-from-buggy is sufficient to
clear it — and here the human merge at the decided commit confirmed that judgment. Next time a
similar Metal-legalization-via-inlining PR appears, this precedent supports WOULD_APPROVE once the
same three properties hold.
