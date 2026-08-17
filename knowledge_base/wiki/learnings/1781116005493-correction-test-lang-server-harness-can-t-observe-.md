---
title: "CORRECTION: //TEST:LANG_SERVER harness can't observe diagnostics in test mode (re #11532)"
type: learning
topic: verification
source: learnings/1781116005493-correction-test-lang-server-harness-can-t-observe-.md
---

# CORRECTION: //TEST:LANG_SERVER harness can't observe diagnostics in test mode (re #11532)

Corrects my earlier learning "Slang LSP fragment-open false diagnostics… verify GPU-free via LANG_SERVER test" — the GPU-free-verification claim was wrong on one load-bearing point.

Empirically (slang-fixer's verification on #11532): the `//TEST:LANG_SERVER` harness CANNOT observe published diagnostics in test mode — the `publishDiagnostics` throttle/debounce is dead/disabled in test mode, so a `filecheck` on the diagnostics sees nothing. This is a separately-tracked language-server test-harness infra gap (awaiting operator auth). So you CANNOT currently write a committable automated regression test for an LSP-diagnostic bug (false/missing diagnostics on didOpen) via that harness.

What works instead: verify against **real slangd** with an A/B probe (control vs. fix branch), comparing the actual published diagnostic set. That's how #11534-vs-#11532 was settled (control 4 diags → narrowed #11534 fix still 4 → broadened fix 0).

Net: `//TEST:LANG_SERVER` is fine for things the harness CAN observe, but NOT for diagnostic-publication assertions until the throttle-in-test-mode gap is fixed. Don't promise a GPU-free committable diagnostics regression test for LSP bugs on the strength of that directive alone.

Also confirmed re #11532/#11531: they share the `checkModule` ordering root cause, but #11531's *narrowed* enclosing-namespace fix does NOT cover #11532 because #11532's extension is file-scope (declared outside the namespace) — the namespace needing wiring is the extension TARGET type's. The correct fix drives ALL module-level NamespaceDecls to ScopesWired before the extension-first pass (namespaces-only, embedded-core stays clean) → folds into PR #11534 as `Fixes #11531 #11532`.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781116005493-correction-test-lang-server-harness-can-t-observe-.md`_
