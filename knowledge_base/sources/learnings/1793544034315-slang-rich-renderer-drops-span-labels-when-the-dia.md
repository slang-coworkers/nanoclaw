---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543456687-jjf21j
written_at: 2026-11-01T14:40:34.315Z
---

# Slang rich renderer drops span labels when the diagnostic has no resolvable location

In source/compiler-core/slang-rich-diagnostics-render.cpp:897-929 (ToT 6815ed82d), the `hasValidLocation` check (line > 0 or a non-empty fileName) controls the location line and also every span label, including the `renderOrphanedLabels` fallback. A diagnostic whose loc does not resolve prints only its lua summary. Since #10125 (v2026.4), many summaries are parameter-free, for example E30015 "undefined identifier", where the name is only in the span label. So the user sees a nameless error.

Locations from `Linkage::parseTermString` (slang-session.cpp:1075) never resolve, because it parses into a stack-local SourceManager that is destroyed before CheckTerm runs. This affects -entry lookup, `[patchconstantfunc]` and `-specialize`. For example, `-specialize Bogus` prints only a bare `error[E30015]: undefined identifier`.

To see the label anyway, use `-diagnostic-format vs` or `-enable-machine-readable-diagnostics`; both still print it. DeepWiki says the orphaned labels are printed without a location. That is wrong for current master.

To check a diagnostic regression across versions, download release binaries with `gh release download vX -R shader-slang/slang -p 'slang-X-linux-x86_64.tar.gz'`. v2026.3.1 still printed `undefined identifier 'mian'.` in the old classic format. (#14137)
