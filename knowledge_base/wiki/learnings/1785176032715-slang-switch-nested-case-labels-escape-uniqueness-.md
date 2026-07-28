---
title: "slang-switch-nested-case-labels-escape-uniqueness-and-ICE"
type: learning
topic: slang-compiler
source: learnings/1785176032715-slang-switch-nested-case-labels-escape-uniqueness-.md
---

# slang-switch-nested-case-labels-escape-uniqueness-and-ICE

**shader-slang/slang#12239** — `case`/`default` labels nested inside inner block or `if` statements within a `switch` body slip past the front-end uniqueness/placement checks, causing (1) silent duplicate-case HLSL and (2) an ICE. Verified @HEAD 70462843c on the CPU compile path (no GPU).

**Root cause — a traversal-depth mismatch between two passes over the switch body:**
- `SemanticsStmtVisitor::validateCaseStmts` (source/slang/slang-check-stmt.cpp:360-399) unwraps the body to its top-level `BlockStmt`→`SeqStmt` then iterates **only the direct children** (`for (auto& sStmt : seqStmt->stmts)` :372). A `case` nested one level deeper (in a `{ }` block or `if`) is never inspected, so its exprVal is never added to the `HashSet<Val*>` and `Diagnostics::SwitchDuplicateCases` (E30605, :383) never fires.
- `lowerSwitchCases` (source/slang/slang-lower-to-ir.cpp:9221-9324) instead **recurses** through `BlockStmt`/`SeqStmt` (:9245-9251) and hoists a nested `case` into the flat IR switch (info->cases.add :9279-9280) → duplicate `case int(0):` emitted, exit 0, no diagnostic. But it does NOT unwrap `IfStmt`: a `case` inside an `if` falls into the "ordinary statement" branch (:9301-9323), is lowered via `lowerStmt` (:9320), and the inner `CaseStmt` reaches `visitCaseStmtBase` (:8077-8079) → `SLANG_UNEXPECTED("case or default not under switch")` → **E99997 ICE**, exit 255.

**Fix direction (recommended, producer-side):** make `validateCaseStmts` recurse and REJECT any case/default that is not a direct child of the switch body, with a new 306xx diagnostic (next to switch-duplicate-cases 30605 / switch-multiple-default 30602 in slang-diagnostics.lua). Closes BOTH facets at the semantic layer; matches the documented rule (case/default must be directly nested under switch) and the reporter's stated expected behavior. Avoid the consumer-side band-aid of just guarding the :8079 assert (leaves facet 1 open).

**Dedup lesson — the switch front-end family shares a file cluster but has DISTINCT root sites; don't reflexively dedup:** #9999/#12236 = pre-first-`case` statement drop at `lowerSwitchCases:9305`; #12237 = bool-condition SPIR-V assert in `processSwitch`; #12238 = float-condition coercion gap (`visitSwitchStmt` TODO :406); #12239 (this) = nested case-label placement hole (`validateCaseStmts` shallow scan vs `lowerSwitchCases` recursion). All authored/driven by skiminki-nv as systematic switch-diagnostic hardening. Author self-files+self-defers → hold the fix (no PR) until an explicit "make a PR".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785176032715-slang-switch-nested-case-labels-escape-uniqueness-.md`_
