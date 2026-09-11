---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787357416293-3boe10
written_at: 2026-09-10T20:13:38.256Z
---

# [approver/challenger-miss] Inheritance constraint-matching: equality constraints resolve BOTH endpoints eagerly — a distinct re-entrancy surface the directed-constraint fix doesn't cover

**Context:** slang#12690 (`_calcInheritanceInfo` in source/slang/slang-check-inheritance.cpp) fixes issue #12659 — a false E38029 from eagerly `ensureDecl`-ing an unrelated sibling constraint whose dependent super-type re-enters the in-progress inheritance query. The fix (rev 4 @ f4045fa6a66b) moves the subject-relevance filter *before* `ensureDecl` and extracts it into `_tryGetCheckedConstraintBaseForLookupType` / `resolveConstraintTypesForInheritanceMatch` ({Resolved,Deferred,Invalid}).

**The probe (what to check on any change to this area):** The fix is asymmetric between the two constraint kinds:
- **Directed** `S : B`: only the subject `S` is resolved for the relevance test; the super-type `B` is deferred to `ensureDecl` AFTER the relevance filter. So an unrelated dependent `B` never triggers the re-entrant query. This is the tested #12659 path (positive INTERPRET tests + a negative E38029 diagnostic test).
- **Equality** `L == R`: BOTH endpoints are resolved *eagerly* by `resolveConstraintTypesForInheritanceMatch` (it must, since either endpoint can match `selfType`) — i.e. BEFORE the relevance filter. A multi-level `MemberExpr` endpoint returns `Deferred` (safe), but a generic-app-leaf endpoint (e.g. `__constraint Alias == G<Context>`) is force-resolved via `TranslateTypeNodeForced`, which can re-enter the in-progress inheritance query — the same failure mode the PR fixes for directed constraints. Devin flagged this ("dependent equalities remain re-entrant", :1163) on two consecutive heads; the production claude-code-action review rated the *directed* rework ✅ Clean and did not surface it.

**Status / caveats:** Unverified without a build. Plausibly PRE-EXISTING (the pre-PR `tryResolveConstraintTypes` also resolved equality endpoints eagerly), and the triggering shape (an equality whose endpoint is a dependent generic-app, sitting beside the dependent siblings being computed) is unusual — so it may be unreachable in practice. It is NOT the #12659 directed bug. Recorded decision: ABSTAIN_POLICY/CHALLENGER_CONCERN (couldn't verify; also no fresh primary review on the +189/−145 rework — Devin-only tier — and an open maintainer CHANGES_REQUESTED).

**How to catch it next time:** When reviewing changes to inheritance/constraint-matching that special-case directed vs equality constraints, explicitly ask "does the equality branch resolve endpoints eagerly on a path the directed branch defers?" A repro to try under a build: an interface with `associatedtype Context : C; __constraint Alias == G<Context>;` beside `associatedtype First : G<Context>;` and check whether the equality triggers a spurious E38029 the directed bounds no longer do. Two review sources disagreeing (production ✅ Clean vs Devin 🔴) on a specific line is itself the signal to dig, not average away.

**Also:** the same PR's earlier `SLANG_RELEASE_ASSERT(selfIsSub||selfIsSup)` (rev 2/3) — a real robustness concern — was resolved in rev 4 by returning `NoBase` gracefully when error recovery replaces endpoints with `ErrorType`. Good pattern: prefer graceful no-contribution over asserting an invariant that error recovery can violate.
