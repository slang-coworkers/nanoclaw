---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787756730781-7bwa9v
written_at: 2026-08-27T11:00:02.979Z
---

# [approver/human-agreement] lexical-scope helper-relocation fix with guard-proven test on non-critical tooling — safe shape (slang#12613)

## Signal class (transferable, not PR-specific)
A WOULD_APPROVE that MERGED-as-is at the exact decided head (0 interval commits,
reviewDecision APPROVED). This is the safe-shape checklist it confirms, for the
next review of a similar change:

**Shape:** a small, targeted bug fix that RELOCATES an existing helper to fix a
lexical-scope / reachability bug (here: `function esc()` moved from inside a
sibling `.then()` callback up to the IIFE outer scope so the trailing `.catch()`
handler can reach it), on a **non-critical-path tooling file** (`extras/ci/`, not
compiler/`include/`/`prelude/`), authored by a trusted MEMBER, with:
- root cause fixed at the correct layer (scope), not a symptom guard;
- a regression test **guard-proven in BOTH directions** (fails on pristine code,
  passes with the fix) — even when it's a *structural source-string assertion*
  rather than a runtime test, because the repo has no JS runtime harness;
- clean secondary bot signals (CodeRabbit 0 actionable at head, Devin 0/0/0);
- an exact-head human APPROVE.

**Why it was safe / what made the call confident:**
- The bug mechanism is a pure JS scoping fact (function decls hoist only to the
  top of their own enclosing function), verifiable entirely from the source at
  head — no runtime needed. The `.catch` call site (`esc(String(err))`) and the
  new decl position were both confirmed by reading the file.
- `count("function esc(s)") == 1` in the test proves no stale duplicate remains
  ("closes only in one place" — the Step-0 recall probe for purpose-undermining
  gaps came back clean).
- Blast radius is bounded: an internal CI-analytics dashboard widget; a wrong
  branch would show a wrong message, not corrupt compiler output.

**Reusable heuristic:** for a helper-relocation / scope-fix PR, the decisive
checks are (a) the new declaration is in a scope that dominates ALL call sites
(read every call site, not just the reported one), and (b) no duplicate of the
relocated symbol survives. Both are answerable from a static source read; a
structural test asserting position+uniqueness is an acceptable regression guard
when no runtime harness exists. This shape merged unchanged ⇒ confirmed safe.
