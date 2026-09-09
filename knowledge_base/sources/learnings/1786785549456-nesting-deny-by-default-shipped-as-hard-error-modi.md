---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786784888974-rxkcyr
written_at: 2026-08-15T09:19:09.456Z
---

# Nesting deny-by-default shipped as hard error; modifier deny-by-default cannot

Slang#12558 (modifier allow-list) vs the already-landed nesting allow-list (#510 modifier half): both invert an allow-by-default check to deny-by-default, but they DIVERGE on rollout and the difference is load-bearing for triage.

- The nesting table (`DeclNestingCategory`, slang-check-decl.cpp:44-338, ~295 lines) shipped as a **hard error with NO version gate** (`DeclNotAllowedInContext` E31400, unconditional in visitDecl:572). It could, because a nesting violation is almost always genuinely invalid code.
- The modifier check (`isModifierAllowedOnDecl` slang-check-modifier.cpp:1675, `default: return true` @:1826) canNOT flip straight to error: the modifier/attribute/semantic universe flowing through that switch is 100+ node types (slang-ast-modifier.h ~273 classes, ~112 `*Modifier`), only 67 have explicit cases, and real programs carry silently-tolerated no-op modifiers today ⇒ a blanket hard error is BREAKING. Rollout must be warning-first, then error behind a language-version gate.
- Transferable rollout mechanism: `volatile` warn→error at slang-parser.cpp:10284-10296 (call-site if/else on `currentModule->languageVersion`; no per-diag warnings-as-errors knob). ⚠ `SLANG_LANGUAGE_VERSION_202C` is NOT in-tree yet (latest _2026; only in open PR #12179) ⇒ a warning stage ships independently, an error stage inherits that dep.
- In-tree example of the exact warning-first pattern: `constexpr-unsupported` E31227 warning (slang-diagnostics.lua:3177), added by PR #12557 for constexpr-on-callable.

LESSON: "mirror the existing deny-by-default table" is a real plan, but don't inherit the PRECEDENT's severity/gate — a check over a mostly-silently-tolerated input universe needs a staged rollout even when its structural twin didn't. Verify whether the precedent's inputs were "almost always invalid" (nesting) vs "often historically tolerated" (modifiers) before assuming the same severity is safe.

Also: a bot-filed tracking issue's "#N is closed" can go stale within minutes — #12558's body said #510 was closed (true when written), but tangent-vector reopened+renamed #510 ~2 min after #12558 was created, creating a live dedup overlap. Re-read referenced-issue state at triage time, not from the body.
