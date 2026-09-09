---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786733963343-zvxvjy
written_at: 2026-08-14T19:28:11.218Z
---

# [approver/challenger-miss] loc-resolver conversion PRs: audit EVERY findSourceView call site, not just the ones the diff touched

**PR:** shader-slang/slang#12421 @ 8cd02a1b29c3 (re-land of macro-expansion-stack diagnostics). Decision: ABSTAIN_POLICY / CHALLENGER_CONCERN. Primary production review (github-actions[bot]) reported **0 bugs**; the head-current Devin signal flagged it and the approver verified it in source.

**Symptom.** A PR introduces a new "indirect" source-loc space (macro-body tokens remapped into a *viewless* `MacroExpansionEntry` range) and adds an expansion-aware resolver `findSourceViewThroughExpansion` to replace bare `findSourceView`. It converts the resolver at 3–4 call sites — but MISSES one. At the missed site the primary error's source snippet + caret underline silently vanish (the exact feature the PR ships), because `findSourceView` returns null for a range with no backing SourceView.

**Root cause / trace.** `slang-rich-diagnostics-render.cpp`: `makeLayoutSpan:762` stores the RAW remapped loc as `LayoutSpan.startLoc` (it calls `getHumaneLoc`, which takes loc BY VALUE — `slang-source-loc.cpp:1081` — so the resolver's in-place unmap never leaks back to `startLoc`). Then `buildSectionLayout:402-403` resolves `startLoc` with the un-converted `findSourceView` → `sourceAvailable=false` → snippet/underline dropped. Converted correctly elsewhere: `getHumaneLoc` (1081), machine-readable renderer (:919), text-path `formatDiagnostic` (sink:457), note walker `appendMacroExpansionNotes` (sink:713 unmaps its span).

**How to catch it (transferable).** When a PR adds a wrapper/variant of an existing lookup (`findX` → `findXThrough…`), the risk is NOT in the lines the diff changed — it's in the call sites it *didn't*. **Grep the whole tree at head for the OLD function name and audit each remaining caller**: does it feed the new indirect key? If yes and it wasn't converted, that path silently degrades. Here: `grep -n findSourceView` across the affected files would have surfaced :402 as the lone un-converted primary-loc consumer.

**Why CI + the doc missed it.** Tests were `non-exhaustive` and asserted only message text + the "expanded from" note — never the underline/source-line surface. Confirms the standing prior: **a source-loc change has no writable test unless a diagnostic fires AND the assertion covers the LOCATION surface (snippet/underline), not just the message.** A 🟡 "tests are thin" gap cluster in the doc is a *tell* that the loc-correctness surface is under-covered — probe it, don't wave it through.

**Blast radius discipline (why ABSTAIN not BLOCK).** The regression was scoped to `-enable-experimental-rich-diagnostics` (options.cpp:2823); default text + machine-readable paths were correct, and it's a degradation not a crash. So it's a challenger CONCERN with a real trigger + real (flag-gated) blast radius the doc missed → human must look → ABSTAIN_POLICY. It was NOT a doc-🔴, so not an auto-BLOCK. Always pin the reachability of a verified defect (default vs opt-in flag) before choosing BLOCK vs ABSTAIN.

**Re-land note (confirmed safe direction).** The revert-root-cause check PASSED: the side-table + tiny-range design structurally eliminates the per-invocation 1.2MB SourceView allocation (× ~153 core-module invocations) that caused the #11351 revert; `PathInfo::Type::MacroExpansion` cleanly removed (0 tree refs at head). For a re-land, always confirm the NEW mechanism makes the OLD failure impossible — this one did.
