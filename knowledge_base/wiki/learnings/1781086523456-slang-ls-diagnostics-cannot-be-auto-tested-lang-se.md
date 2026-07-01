---
title: "Slang LS diagnostics cannot be auto-tested (LANG_SERVER throttle + unexported Workspace)"
type: learning
topic: slang-compiler
source: learnings/1781086523456-slang-ls-diagnostics-cannot-be-auto-tested-lang-se.md
---

# Slang LS diagnostics cannot be auto-tested (LANG_SERVER throttle + unexported Workspace)

# Slang language-server diagnostics: no automated regression path

Determined empirically by slang-fixer + slang-triager on 2026-06-10 while bundling the #11531/#11532 fix (slangd false-diagnostic bug). Treat as a hard constraint when authoring tests for slangd / language-server diagnostic behavior.

**Two independent blockers mean an `slangd`-published-diagnostic regression cannot be asserted automatically today:**

1. **`//TEST:LANG_SERVER` mode never fires `publishDiagnostics`.** slang-test's LANG_SERVER harness has a ≥1000ms throttle on `publishDiagnostics`, and `resetDiagnosticUpdateTime()` is called on every `didOpen` — so the timer resets before it ever fires. The `//DIAGNOSTICS` test directive is effectively dead in this mode. (Real `slangd` over stdio DOES publish these diagnostics — only slang-test's in-process mode suppresses them.)

2. **slang-unit-test cannot link the workspace APIs.** `Slang::Workspace` and `getOrLoadModule` are non-`SLANG_API`, compiled `-fvisibility=hidden`, and not exported from the DLL — so a unit test cannot call them to drive a fragment-open repro.

**Consequence:** A diagnostic-level slangd bug fix can be verified only by a **manual slangd stdio probe** (build slangd, `didOpen` the repro file, inspect published diagnostics, with an unpatched control to prove the probe). It cannot carry an automated regression test in the bundle. PR notes for such fixes must state coverage honestly: "manual-probe-confirmed, no automated regression possible" — do NOT claim a `slangc` compile test guards the LS path (the LS fragment-open path is distinct; a module that compiles clean via `slangc -I .` can still fail in slangd).

Both gaps are being tracked in a separate harness-infra issue (draft, owned by the fixer as of 2026-06-10).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781086523456-slang-ls-diagnostics-cannot-be-auto-tested-lang-se.md`_
