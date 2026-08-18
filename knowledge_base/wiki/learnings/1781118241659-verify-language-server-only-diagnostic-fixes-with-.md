---
title: "Verify language-server-only diagnostic fixes with a real-slangd LSP stdio probe"
type: learning
topic: verification
source: learnings/1781118241659-verify-language-server-only-diagnostic-fixes-with-.md
---

# Verify language-server-only diagnostic fixes with a real-slangd LSP stdio probe

When a Slang fix changes diagnostics that only manifest in the **language server** (e.g. slang#11532: false errors in the editor that a CLI `slangc` run doesn't reproduce, or that the slang-test `LANG_SERVER` harness can't see), the normal `tests/` route does NOT work and there's no committable regression test.

**Why the test harness can't observe it:** slang-test `LANG_SERVER` mode does not surface `publishDiagnostics` in test mode — `publishDiagnostics` is throttled by the `resetDiagnosticUpdateTime` call that precedes it under `-periodic-diagnostic-update false`. And a `slang-unit-test` can't link the `Workspace`/`getOrLoadModule` symbols (non-`SLANG_API`, `-fvisibility=hidden`).

**What works:** a hardened real-`slangd` LSP **stdio probe** — a small Python script that spawns the built `slangd`, does the LSP `initialize` handshake, opens the repro files via `didOpen`, waits N seconds, and collects `textDocument/publishDiagnostics` notifications. Harden it to assert the init ack and fail on parse/framing/reader errors or early slangd exit, so a false "clean" can't be silently reported. Run A/B: unpatched slangd (control) vs your patched slangd; the fix is proven when control reports the bug's diagnostics and patched reports 0.
Reusable probe + repro: `/workspace/agent/wt-slang-11532/expt-logs/probe_slangd.py` + `probe11532/`; invoke `python3 expt-logs/probe_slangd.py <path-to-slangd> expt-logs/probe11532 <entry.slang> 6`. Build slangd with the embedded core module (default preset) for a faithful probe. Disclose in the PR that the LS-only case is probe-verified, not covered by an automated test, and point at the harness-gap tracking issue.

Bonus (slang#11531/#11532 root cause, reusable for namespace/extension phase-ordering bugs): to make a reopened-namespace fragment's types resolvable by an extension's unqualified header lookup, drive the relevant `NamespaceDecl`(s) to `DeclCheckState::ScopesWired` BEFORE checkModule's extension-first pass. Use a namespaces-ONLY pass (`discoverNamespaceDecls` mirroring `discoverExtensionDecls`), NOT `ensureAllDeclsRec(moduleDecl, ScopesWired)` over all decls — the latter prematurely advances the stdlib's non-namespaced `extension _Texture<...>` and aborts the embedded-core-module compile with InternalError. ScopesWired on a namespace only wires sibling scopes (+ direct `using` decls), never members/extensions; extension target checking is at `ReadyForLookup` (via `SemanticsDeclBasesVisitor::visitExtensionDecl`), strictly later — so a namespaces-only pass is core-safe. Always confirm by a full `cmake --build` (compiles `*.meta.slang`); a clean C++ link does NOT catch the core-module regression.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1781118241659-verify-language-server-only-diagnostic-fixes-with-.md`_
