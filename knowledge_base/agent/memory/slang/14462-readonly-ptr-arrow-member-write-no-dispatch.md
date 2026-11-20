---
type: chain
title: "slang#14462 — `->` member write through read-only pointer: NEEDS NO DISPATCH (human-owned)"
description: Redelivered issue_opened webhook 11-16 for a 11-12 issue that skiminki-nv triaged personally and assigned to reporter kmate19, whose fix PR #14495 is in review. Bot stands down.
---

# slang#14462 — `->` member write through read-only pointer — NO DISPATCH

- **Issue:** filed 11-12 16:27Z by kmate19 (human): member reached via `->` on `Ptr<T,Access.Read/Immutable>`/`ImmutablePtr` is writable (assign, compound, `inout`, atomic), while `p[i]`/`(*p)` forms correctly reject E30011/E30047. Relates #14094 (`__getAddress`/QualType cause, jhelferty-nv-owned) and #8499 (missing `NonWritable`).
- **Webhook:** `issue_opened` for #14462 arrived (redelivered) 11-16 08:45Z, session `sess-1794818752476-e2pv1j`, thread `gh-issue-shader-slang/slang-14462` — no dispatch made. Verified via unauthenticated API (`curl --noproxy '*'` — gateway auth was 401 that morning).
- **Human-owned, rung 4 — DO NOT dispatch triager or fixer:**
  - skiminki-nv triaged personally (11-13: confirmed on master 6d8bd0f47, root cause at slang-check-expr.cpp:712) and assigned the issue to kmate19 (11-13 20:01Z, "Happy to take this" → assigned).
  - Reporter's fix PR **#14495** ("Reject writes through read-only pointers, and warn for unknown access", head `fix-14462-readonly-ptr-member-write`) open since 11-15, reviewer skiminki-nv requested, 12 review comments, active 11-15 21:45Z.
  - Maintainer direction on scope (refined 11-17 09:33Z, comment 6944203775): after talking with
    tangent-vector, skiminki-nv says be **even more conservative** than the 11-13 note — even a direct
    `p->count = 1` through `Ptr<_,Access.ReadOnly>` should be only a **warning in Slang 2026 and
    previous** (error in 202c). Asked tangent-vector to confirm (pending as of 11-17). If confirmed,
    PR #14495's severity likely needs to drop from error to warning for the 2026 line.
- **11-17 09:33Z `pr_mention` webhook (comment 6944203775):** no `@nv-slang-bot` mention in the live
  body — question addressed to @tangent-vector. Verified against the live comment; no reply posted,
  no dispatch, no relay. The #14496 chain is unaffected by the severity shift (its fix routes writes
  through the nonmutating setter in lowering; it adds no new diagnostics).
- **Stand-down precedent:** external-pr + maintainer-assigned (#13766/#13765 pattern). If a future webhook mentions the bot on #14462/#14495, relay only — never open a second chain.

# Citations
- https://github.com/shader-slang/slang/issues/14462
- https://github.com/shader-slang/slang/pull/14495
