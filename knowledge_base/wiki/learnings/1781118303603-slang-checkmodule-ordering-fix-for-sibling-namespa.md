---
title: "Slang checkModule ordering fix for sibling-namespace resolution: namespaces-only, NOT ensureAllDeclsRec (#11531/#11532)"
type: learning
topic: slang-compiler
source: learnings/1781118303603-slang-checkmodule-ordering-fix-for-sibling-namespa.md
---

# Slang checkModule ordering fix for sibling-namespace resolution: namespaces-only, NOT ensureAllDeclsRec (#11531/#11532)

For the #11531/#11532 class of bug (unqualified names across reopened-`namespace` fragments fail to resolve because the extension-first validation pass in `checkModule` resolves extension/struct headers before sibling-namespace fragments are wired to `ScopesWired`), the CORRECT fix is a pass that drives **all module-level `NamespaceDecl`s (only)** to `ScopesWired` BEFORE the extension-first pass — implemented as a new `discoverNamespaceDecls` helper in `source/slang/slang-check-decl.cpp`.

Two corrections learned the hard way:
1. **Do NOT use `ensureAllDeclsRec(moduleDecl, ScopesWired)`** (driving *all* decls early). My original triage Approach A suggested that — it REGRESSES the embedded core module (canary: `_Texture` / `InternalError` recurrence on embed-core compile). Scope the early `ScopesWired` advance to namespaces only.
2. **A narrowed per-extension *enclosing-namespace* walk is insufficient.** That's what PR #11534 first shipped for #11531; it does NOT cover **file-scope** extensions (`extension N::T` declared OUTSIDE `namespace N`) — issue #11532 — because there's no enclosing namespace to wire; the namespace needing wiring is the extension TARGET type's. Only the all-namespaces pass covers both. Verified: #11532 real-slangd probe 4 diags → 0; embed-core clean; #11531 repro + suites green; codex APPROVE.

Process pattern (cross-session branch collision): when the fix for issue B must land on a branch owned by a LIVE sibling session working issue A (e.g. two slang-fixer sessions, one owns PR #11534 / worktree wt-slang-11531), DON'T push from a second worktree — it clobbers the live owner's branch (force-push war / lost commits), and worktree-isolation + chain rules bar the sibling sessions from reaching each other. Resolution: route the fold-in to the LIVE OWNER via the common parent — parent relays the verified patch + integration note to the owner, who lands it on its own worktree collision-free. The owner is also best-positioned since it authored the code being replaced.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781118303603-slang-checkmodule-ordering-fix-for-sibling-namespa.md`_
