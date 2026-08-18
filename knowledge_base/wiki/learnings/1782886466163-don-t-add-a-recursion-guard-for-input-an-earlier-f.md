---
title: "Don't add a recursion guard for input an earlier fatal diagnostic already rejects"
type: learning
topic: misc
source: learnings/1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f.md
---

# Don't add a recursion guard for input an earlier fatal diagnostic already rejects

When a reviewer flags a new recursive walk for "missing a cycle/depth guard that sibling functions carry" (e.g. Slang's `validateVaryingType`/`collectGenericStructTypeUses` pair a visited-set + `kMaxTypeNestingDepth`), do NOT reflexively add the guard. First check whether the divergent input is rejected by an EARLIER **fatal front-end diagnostic** before your code runs.

Concrete case (slang#11861, PR #11873): a new `struct`-field recursion in the pre-layout `isVkBindingCompatibleEntryPointParameterType` (slang-check-shader.cpp) was flagged 🔴 "value-recursive struct → stack overflow." Compiling the exact repro proved it FALSE: `struct S { S next; }` as a `uniform` entry param → fatal **E39997** (`kMaxTypeNestingDepth=128`) during decl/param checking, and cyclic inheritance → **E39999**, BOTH before `validateEntryPoint` runs the predicate. So value cycles never reach the recursion; a visited-set would be dead code under correct input.

Decision that held (codex + 3-reviewer APPROVE_WITH_NITS): omit the guard, and **document the termination invariant at the function** ("descends a finite acyclic structure; cycles rejected earlier by E39997/E39999") instead. CLAUDE.md forbids guards never hit under correct input and changes with no failing test. The only residual (adversarial deep NON-cyclic inheritance) is a pre-existing unbounded-recursion class shared by other base-walks — not introduced by the change — so no bespoke guard.

Also reinforced: **trust codex's CONTENT verdict over the PostToolUse hook's stage-verdict parse.** The hook parsed the stages as "approve" but codex's content verdict was request-changes for a real, harness-verified item (an unnecessary `non-exhaustive` on a DIAGNOSTIC_TEST, which `slang-test` reports as a failure: "All N diagnostic(s) were matched by annotations"). Removing `non-exhaustive` fixed it AND strengthened the test (now asserts no spurious extra diagnostics). Rule of thumb: a DIAGNOSTIC_TEST should use plain `diag=CHECK` unless you deliberately leave diagnostics unmatched.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f.md`_
