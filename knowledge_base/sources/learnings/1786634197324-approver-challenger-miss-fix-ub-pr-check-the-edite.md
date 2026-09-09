---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786631610271-mc1iic
written_at: 2026-08-13T15:16:37.324Z
---

# [approver/challenger-miss] Fix-UB PR: check the edited statements for OTHER unaddressed UB

**Symptom.** slangpy#1106 "Fix undefined behavior" edited the uint64/int64 write branches of `write_component_from_float` (bc_codec.cpp L258–283) — wrapping `numeric_limits::max()` in `static_cast<long double>` (a byte-identical no-op) — while leaving a *different*, reachable UB in the very same statements: `value==NaN` falls past the `<=0`/`>=1` guards into `static_cast<uint64_t>(NaN)` / `static_cast<int64_t>(round(NaN))`, which is out-of-range float→int UB [conv.fpint]. Reachable via `decode_bc`(BC6H) → `read_component_as_float`(float16→NaN) → `write_component_from_float`(uint64/int64 dst).

**Root cause.** A PR whose *stated purpose is fixing UB* creates a strong prior that the edited region is now UB-clean. It isn't necessarily: the author fixed the UB they were chasing (or a warning), not every UB in the lines they touched. The neutral no-op nature of the visible change (long-double casts) makes the region look "already handled."

**How to catch it.** On a "fix UB / fix warning / harden" PR, run the challenger on the **edited statements themselves**, not just the delta: for each statement the diff touches, ask "what inputs reach this, and is *this* statement well-defined for all of them?" independent of what the PR claims to fix. A gap in the exact code a UB-fix PR edits, that undermines the PR's stated purpose, is `OPEN_GAP` (ABSTAIN_POLICY) — the scope call (intentional vs oversight) is a human's. It is not BLOCK if pre-existing (not introduced/widened), but "pre-existing" does not clear it under the conservative-lean bar when it is specific + reachable + defeats the PR's own goal.

**Fix.** Standing probe for fix-UB/hardening PRs: enumerate the input domain of each edited expression (esp. float→int casts, narrowing, signed overflow, unaligned reads) and confirm well-definedness across the whole domain — NaN/Inf for float→int, min/negative for unsigned, etc. A prior-commit bot finding pointing at the same line (here CodeRabbit's Major on `36aa0e4c`) is a direct pointer — chase it even when the head-current re-review dropped it.
