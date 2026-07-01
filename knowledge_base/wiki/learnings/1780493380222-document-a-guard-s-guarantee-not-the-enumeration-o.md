---
title: "Document a guard's guarantee, not the enumeration of how the bad input arrives"
type: learning
topic: misc
source: learnings/1780493380222-document-a-guard-s-guarantee-not-the-enumeration-o.md
---

# Document a guard's guarantee, not the enumeration of how the bad input arrives

When a guard/predicate is **provenance-agnostic** — it rejects X regardless of *how* X got there — document what it *guarantees*, not a specific claim about "the only way X can arise." Enumerating arrival paths ("X can only happen via Y; the Z path is impossible because the checker rejects it with <error>") is fragile: it's a checkable assertion about compiler behavior that can be wrong even when the guard is correct.

**Why:** On shader-slang/slang#11450 (the `using namespace` import-leak fix), the load-bearing `containerDecl->parentDecl == moduleDecl` conjunct drops a foreign module's `FileDecl` regardless of how it reached the re-export chain. Across three review rounds, **three separate mechanistic explanations of *why the foreign-FileDecl case was supposedly safe/impossible* were each wrong**, while the conjunct itself was always correct:
1. "negative test not constructible because `using namespace <module>;` is rejected" — REFUTED: constructible via plain transitive `import`.
2. "`using namespace <module>;` is rejected with **E30600** (module not accessible)" — wrong error/mechanism.
3. "`using namespace <module>;` is rejected with **ExpectedANamespace**" — also wrong: `class ModuleDecl : public NamespaceDeclBase`, so a module *satisfies* the namespace cast and is NOT rejected by `ExpectedANamespace`; if it resolved, it'd be a *second* arrival path the conjunct also guards.

Each wrong claim was an attempt to justify the guard by enumerating/excluding arrival paths. The correct comment states the guarantee: "any foreign module's `FileDecl` on this chain has `parentDecl` ≠ this module, so it's dropped regardless of how it arrived — keeping plain `import` non-transitive."

**How to apply:**
- In code comments and review reasoning, prefer "this drops X regardless of provenance" over "X can only arrive via Y." The former is robust; the latter invites a wrong, unverifiable behavior claim.
- If an arrival-path claim is genuinely useful (e.g. to steer a future reader away from a dead end), it must be *verified against the type system / source*, not asserted — and even verified, frame it as "one known path" not "the only path."
- This applies to the orchestrator too: don't *direct* a coworker to add a specific mechanistic claim (I pushed the `ExpectedANamespace` framing) you haven't verified. Direct the guarantee; let the implementer verify any mechanism before stating it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1780493380222-document-a-guard-s-guarantee-not-the-enumeration-o.md`_
