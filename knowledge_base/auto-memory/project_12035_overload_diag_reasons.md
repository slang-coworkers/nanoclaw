---
name: project_12035_overload_diag_reasons
description: "#12035 overload-failure diagnostics — maintainer self-assigned, PARKED; A fix-ready, B design-gated"
metadata: 
  node_type: memory
  type: project
  originSessionId: c260cc32-4ceb-48d9-a05e-57220904102f
---

**shader-slang/slang#12035** — "Diagnostics: explain why overload candidates don't apply on failed resolution." Filed + **self-assigned by expipiplus1 (maintainer)** 2026-07-10. DX/diagnostics feature-request, severity low / P3, frontend semantic checker (overload resolution). Not a bug.

**Ask:** on "no overload applies", (1) sort candidates by proximity to supplied args, (2) give per-candidate rejection reason.

**Triage key finding (verified, memo triage-12035.md):** NOT greenfield — #7857 groundwork already records the first arg-type mismatch per candidate (`argMismatch*` in slang-check-impl.h:454-456) and already emits `OverloadCandidateArgumentTypeMismatch` (E40018), and already does a **coarse proximity sort by check-stage** (`status`) at slang-check-overload.cpp:3548-3555. Gaps: arity, l-value/direction, generic-constraint, visibility, fixity rejections show only the bare signature with no reason. `InvisibleOverloadCandidate` note (E40014) exists but only fires in the *ambiguous* branch (3693), not the no-applicable branch.

**Approaches:** A = near-term fix-ready slice — emit per-candidate reasons for arity/visibility/constraint (+optional direction), reuse #7857 pattern + existing InvisibleOverloadCandidate note; diagnostic-only, LOW risk, needs golden-output test updates. B = true proximity ranking — DESIGN CALL (define "proximity": mismatched-arg count vs partial conversion cost vs arity weighting; may need to retain more than the tied-furthest `bestCandidates` set → perf on hot path); MEDIUM risk, needs maintainer sign-off.

**Decision: PARKED, NO auto-dispatch.** Maintainer self-assigned → they drive. Related prior work: #7857. See [[feedback_triage_github_posting]], [[feedback_route_authorizations_through_dispatch_owner]].

**STATE (07-10 04:13 UTC): verdict POSTED + chain PARKED.** Triager posted verified 5-bullet → https://github.com/shader-slang/slang/issues/12035#issuecomment-4931917506 (nv-slang-bot): enhancement · low · P3 · frontend overload resolution; leads with #7857-groundwork finding; frames A (per-candidate reasons, self-contained/low-risk) vs B (proximity ranking, design-gated, semantics deferred to expipiplus1); scoped as a note, no impl promise. Issue Type set to `Feature` (was blank), human labels untouched. No PR, no fixer. **TERMINAL until webhook — re-opens only on a comment/PR from expipiplus1.**
