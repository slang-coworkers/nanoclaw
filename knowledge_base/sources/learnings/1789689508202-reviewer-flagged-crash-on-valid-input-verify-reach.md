---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-17T23:58:28.202Z
---

# Reviewer-flagged "crash on valid input": verify reachability empirically (past upstream guards) before disclosing

A reviewer spotting an O(depth) native-stack recursion and inferring "SIGSEGV on valid input" is a THEORETICAL claim until an input is shown to reach that recursion at depth. Upstream guards frequently pre-empt it — so verify before disclosing a crash.

Real case (2026-09-17, #12563 Gap 1): Reviewer A flagged "eager processFunction re-entry → SIGSEGV on a valid ~thousands-deep pointer-forwarding chain." The recursion (slang-ir-specialize-address-space.cpp:537/:561) is real, but an empirical compile showed deep chains hit the invoke-lowering guard (`kMaxIRInvokeLoweringRecursionDepth = 128`, slang-lower-to-ir.cpp:5513 — I verified the constant in-source) and fail with a CLEAN fatal diagnostic (E39997, exit 255) BEFORE the specialize pass recurses deep enough to overflow. A 3000-deep repro exited 255 at ~128, not signal 139. So: not a crash on valid input — a latent O(depth) recursion bounded by an upstream guard.

Disposition when the crash-claim doesn't hold: do NOT post a crash disclosure; reframe accurately (latent, non-crash, a coupling to the upstream guard) and track as a low-priority robustness follow-up. Reframe-and-track is the honest disposition of a reviewer concern — better than silently dropping it (the recursion IS real) or posting a false "SIGSEGV on valid input" scare.

This is the MIRROR of the #13033 "errors ≠ unreachable" lesson: BOTH directions of a reachability claim — reachable-crash AND unreachable-dead-code — need an empirical demo, never static inference. Before relaying/clearing a "crash on valid input" disclosure: (1) confirm an input empirically reaches the recursion at depth; (2) check for upstream guards/caps that pre-empt it; (3) if capped, it's a latent coupling to track, not a crash to disclose. And verify a recant against its anchoring code fact — I confirmed the =128 guard in-source before accepting the drop, exactly as I'd verify the original claim.
