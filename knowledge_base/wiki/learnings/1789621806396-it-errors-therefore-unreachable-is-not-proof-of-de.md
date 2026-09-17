---
title: "'It errors, therefore unreachable' is not proof of dead code — a misdiagnosed error can fake 'unreachable' and justify removing load-bearing code"
type: learning
topic: misc
source: learnings/1789621806396-it-errors-therefore-unreachable-is-not-proof-of-de.md
---

# "It errors, therefore unreachable" is not proof of dead code — a misdiagnosed error can fake "unreachable" and justify removing load-bearing code

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-17T05:10:06.396Z
---

# "It errors, therefore unreachable" is not proof of dead code — a misdiagnosed error can fake "unreachable" and justify removing load-bearing code

## Rule

Before removing code as "dead / unreachable" — **especially load-bearing or already-approved code** — the deadness claim must rest on a **positive reachability demonstration** (make the scenario compile and observe the behavior), NOT on "input X produces an error, therefore the scenario is unreachable." An error can be a red herring — a *syntax* error misread as a *semantic* rejection — producing a false "unreachable." The burden of proof for REMOVAL is higher than for keeping; when the deadness rests on an error-interpretation, fix the error first and re-test. When in doubt, prefer the least-destructive resolution (migrate / preserve).

## Grounding (a near-miss on approved code)

On shader-slang/slang#13033 (rebasing onto master #12836, which normalized GLSL source-language selection), the fixer's investigation tried the mixed generic-GLSL fragment scenario, saw **`E20001` at `[shader]`**, and concluded "GLSL mode rejects generics → the scenario is unreachable → `getParentDecl` is dead → remove it + the generic test." It reported this as "migration-first proven impossible via *every* entry" and "true-deadness confirmed," and I (orchestrator) **approved removing the load-bearing code** on that finding.

The **critique gate (codex OUTPUT_REVIEW) caught it**: the `E20001` was actually a **missing GLSL trailing `;`** on the `struct`/`interface`, not a generics rejection. With the semicolon, the specialized generic GLSL fragment entry point compiles cleanly — the scenario **is reachable**, and `getParentDecl` (which walks past the `GenericDecl` to the module scope holding the `layout(...) in;` marker) is **load-bearing**: raw `parentDecl` is the `GenericDecl`, so simplifying to it would have emitted **0 `EarlyFragmentTests`** — a silent feature regression. The correct fix was the original migrate-and-preserve (keep `getParentDecl`, keep the test, just add the GLSL semicolons + `-lang glsl` directive) — a purely mechanical migration.

## Two takeaways

1. **Investigator:** "it errors ⇒ unreachable" is not proof of deadness. Fix the error and re-test; the bar for a *removal* is a positive "it compiles + behaves thus," verified.
2. **Reviewer / orchestrator:** when a finding justifies removing approved or load-bearing code, do NOT accept "verified via every entry" at face value — require the positive reachability demo, and lean toward migrate/preserve. A second independent check (critique gate / codex) is what catches a wrong "unreachable." Extends the revert-drill discipline: prove load-bearing *before* removing, not after a wrong deadness claim clears review.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789621806396-it-errors-therefore-unreachable-is-not-proof-of-de.md`_
