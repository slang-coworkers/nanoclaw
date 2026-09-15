---
title: "slangd Completion checking mode retains placement-illegal modifiers (ignoreUnallowedModifier) → manufactures malformed AST shapes that crash downstream"
type: learning
topic: slang-compiler
source: learnings/1789401281467-slangd-completion-checking-mode-retains-placement-.md
---

# slangd Completion checking mode retains placement-illegal modifiers (ignoreUnallowedModifier) → manufactures malformed AST shapes that crash downstream

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789398913065-yrrtl6
written_at: 2026-09-14T15:54:41.467Z
---

# slangd Completion checking mode retains placement-illegal modifiers (ignoreUnallowedModifier) → manufactures malformed AST shapes that crash downstream

From triaging slang-vscode-extension#77 (slangd crash on a function-local `groupshared`).

**A whole class of slangd-only front-end crashes comes from Completion checking mode deliberately keeping modifiers the general checker would strip.** In `SemanticsVisitor::checkModifiers` (`source/slang/slang-check-modifier.cpp:2507-2509`), when `getLinkage()->contentAssistInfo.checkingMode == ContentAssistCheckingMode::Completion`, it sets `ignoreUnallowedModifier = true`. That flag makes `checkModifier` (`:1975-1982`) take the `return m;` branch instead of `diagnose(ModifierNotAllowed); return nullptr;` — i.e. it **retains a modifier that `isModifierAllowedOnDecl` rejects**, with NO diagnostic. The intent is to avoid spurious diagnostics while the user is mid-typing, but it is a *blanket* leniency: it also keeps modifiers rejected for hard *placement* reasons.

Concretely: a `groupshared` on a function-local (`isModifierAllowedOnDecl` = `isGlobalDecl || isEffectivelyStatic`, both false for a `ScopeDecl` parent) is stripped by slangc/general mode (→ E31201, no crash) but RETAINED by slangd in completion mode. That manufactures a "function-local groupshared" — a shape no downstream stage models. If the config then lowers to IR, `maybeSetRate`/`createVar` (`slang-lower-to-ir.cpp:3317-3348`) build a GroupShared-**rated function-local IRVar**, and groupshared consumers (`slang-ir-explicit-global-context.cpp`, `slang-ir-glsl-legalize.cpp`, `slang-ir-typeflow-specialize.cpp`) assume module-global → unguarded null-deref / access violation.

**Triage implications:**
- This is why a crash can be slangd-only (never slangc) AND disappear when one modifier is removed — the general checker strips it, completion mode keeps it.
- **Stock slangd does NOT lower to IR** (`loadParsedModule` skips it when `isInLanguageServer()`, `slang-session.cpp:1149-1155`), so an IR-lowering deref only fires if the crashing config actually compiles (e.g. a VFX-flavor real compile) — this is why such a crash may NOT reproduce via a plain LSP didOpen+semanticTokens+completion driver even though the retained-modifier root cause is present. Don't conclude "not a bug" from a non-repro; verify the modifier-retention path.
- Principled fix is at the producer (`checkModifier`): narrow the completion-mode exception so placement-illegal modifiers (which build shapes no stage models) are still stripped, rather than guarding every downstream consumer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789401281467-slangd-completion-checking-mode-retains-placement-.md`_
