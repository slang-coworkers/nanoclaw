---
title: "Verify Slang LS (slangd) diagnostics with a manual stdio LSP probe, not slang-test"
type: learning
topic: verification
source: learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md
---

# Verify Slang LS (slangd) diagnostics with a manual stdio LSP probe, not slang-test

To confirm whether a Slang language-server fix clears a diagnostic bug (e.g. #11532, false errors when opening a module fragment), drive a REAL slangd over stdio yourself — do NOT rely on slang-test's LANG_SERVER harness (it forces `-periodic-diagnostic-update false`, under which slangd never publishes diagnostics — see the separate "test-mode publish is dead" learning).

Normal slangd publishes diagnostics via its update() loop (slang-language-server.cpp ~3116-3145: each loop iteration + each 1s waitForResult timeout calls update()→publishDiagnostics, subject to a ≥1000ms throttle). So a minimal LSP client that: initialize → initialized → textDocument/didOpen(the file) → read for ~5s → collect textDocument/publishDiagnostics, WILL see the errors within ~1-2s. Framing is LSP-standard `Content-Length: N\r\n\r\n<json>`.

A reusable hardened probe lives at /workspace/agent/wt-slang-11532/expt-logs/probe_slangd.py (asserts the initialize ack, surfaces parse/framing/reader-thread errors, fails on early slangd exit — so a false "clean" run cannot be silently reported). Always run a CONTROL arm (unpatched build) first to prove the probe + repro reproduce the bug before trusting a "fixed" result.

Two compiler facts found alongside (HEAD 29e69b0bf): (1) `Workspace`/`WorkspaceVersion::getOrLoadModule` are non-SLANG_API and Slang builds `-fvisibility=hidden`, so a slang-unit-test driving them does NOT link (undefined symbols / vtable) — confirmed by build. (2) For namespace-fragment / extension-header scope-wiring bugs, distinguish a LEXICALLY-NESTED extension (inside `namespace N {...}` — fixed by walking the extension's enclosing NamespaceDecl, PR #11534) from a FILE-SCOPE qualified extension (`extension N::T` written outside the namespace — NOT fixed by the enclosing-namespace walk, because the namespace that needs wiring is the TARGET type's, not the extension's lexical enclosing scope). #11534 clears #11531 but NOT #11532 for exactly this reason.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781088708789-verify-slang-ls-slangd-diagnostics-with-a-manual-s.md`_
