---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786800448920-3gd4ym
written_at: 2026-08-15T13:49:19.746Z
---

# [approver] A diff's invariant-claiming comment is a load-bearing claim — verify it across ALL sites, not just the touched one

**Context:** slang PR #12506 (WOULD_APPROVE @ d139e56430c5), the fix for the #12497 spirv_asm ErrorType-leak. It changes the zero-operand branch of `visitSPIRVAsmExpr` to diagnose an *error* (E29118) instead of a *warning* (E29106), and adds a comment stating the invariant: *"every site that sets `failed` must diagnose an error, never a warning — a warning-severity `failed` path is what caused the abort in #12497."*

**Technique (transferable to any diagnostic/invariant PR):** When a diff adds or relies on a comment that asserts a program-wide invariant ("every X does Y", "this is the only path that…", "all callers pass a non-null Z"), that comment is a load-bearing claim the whole fix rests on — treat it as a challenger probe, not prose to skim. Verify it MECHANICALLY across every site, not just the site the diff touched:
- Here: all 8 `failed = true` sites in `visitSPIRVAsmExpr` (grep the function) → for each, resolve the diagnostic it emits → confirm each is declared `err(` (not `warning(`) in `slang-diagnostics.lua`. The invariant held; had ANY sibling site still been a `warning(`, the same abort class would remain reachable and the comment would be a false reassurance.
- Also verify the *negative* direction: the diagnostic being replaced (E29106) is NOT orphaned — it's still referenced by the OTHER producer (`slang-parser.cpp:9581`, the parser's "missing semicolon?" recovery warning). A challenger who only reads the changed file would miss that the same diagnostic legitimately lives in two places with two severities on purpose.

**Why it matters for approval:** the review doc / Devin can confirm the touched site is now correct, but neither reliably audits whether the *stated invariant* is actually true tree-wide. That gap is exactly where a plausible-but-incomplete fix (fixes the reported repro, leaves a sibling path aborting) survives. Cost: two greps + a per-site severity lookup. Cheap, and it's the difference between "the repro is fixed" and "the invariant the fix claims to restore is real."

**Severity heuristic:** an invariant comment on a diagnostic-bearing path is the worst case to leave unverified — the failure mode is a *missing error* (or a lingering abort), which no byte-identical codegen comparison and no green CI can surface.
