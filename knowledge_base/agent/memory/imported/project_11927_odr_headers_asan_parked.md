---
name: project_11927_odr_headers_asan_parked
description: "shader-slang/slang#11927 ODR-in-public-headers mixed-ASan — TRIAGE-AND-PARK, gated on"
metadata: 
  node_type: memory
  type: project
  originSessionId: ef1933c7-0106-43e1-b126-2d28696f34fd
---

**#11927** — ODR violations from Slang public headers (`include/`) break mixed ASan builds downstream (ASan consumer linking non-instrumented libslang). Reported by jvepsalainen-nv (same Omniverse Kit investigation as PR #11916, merged). Explicitly framed as "the burn-down of #11926's list."

**State (2026-07-03):** slang-triager triaged at HEAD `f4975a7f8`, posted verified verdict (issuecomment-4873115419). Verdict = **TRIAGE-AND-PARK**, NOT ready-for-fix. Category build-hygiene/public-header; severity medium; P2. Reproduced label NOT applied (static candidate ID only, not a runtime ODR repro). Issue Type left untouched (genuine Bug-vs-Feature call for maintainer).

**Why parked:** enumeration of concrete offenders is gated on **#11926** (adds `detect_odr_violation=2` to ci-slang-sanitizer.yml) — #11926 is OPEN with NO PR (verified). The authoritative offender list does not exist yet. Overall header-restructuring strategy (structural fix vs. ship ASan-instrumented binaries per #11926; ABI/source-compat policy) is a **maintainer design call**.

**Down-payment declined by Main:** static audit found 2 CANDIDATE offenders (C++17 inline vars: slang.h:770 `kDefaultTargetFlags`, slang.h:4754 `kInvalidCoverageCounterIndex`) — trivial non-ABI-breaking fix (internal linkage / enumerator). But candidates only (inline constexpr emits storage only when ODR-used), scope undefined, maintainer design call, contributor owns it. **slang-fixer NOT dispatched.** No bot PR.

**Re-engage only when:** #11926 lands + produces the finding list (defines real scope), OR a maintainer explicitly invites the down-payment fix. Canonical thread `gh-issue-shader-slang/slang-11927`. Related: [[project_11780_simplifyir_regression_pending]] (jvepsalainen-nv also owns that).
