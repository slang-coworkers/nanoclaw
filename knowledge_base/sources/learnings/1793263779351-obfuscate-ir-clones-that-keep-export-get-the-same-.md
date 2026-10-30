---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793263156081-rhr0mr
written_at: 2026-10-29T08:49:39.351Z
---

# -obfuscate: IR clones that keep [export] get the same emitted name (no name hint to uniquify)

Under `-obfuscate`, name hints are stripped. `CLikeSourceEmitter::generateName` (slang-emit-c-like.cpp ~1270) then names a function from its linkage (export) name VERBATIM, with no `_generateUniqueName`. So any IR pass that clones a function and keeps the original's IRExportDecoration creates two emitted functions with the same `_Sh<hash>` name. Without `-obfuscate`, the name-hint path hides this (`foo_0`, `foo_1`). WGSL then fails with a redeclaration error. Address-space specialization (slang-ir-specialize-address-space.cpp `specializeFunc`) had this bug (#14004).

The precedent rule for clones is in slang-ir-lower-buffer-element-type.cpp ~1909: keep linkage only when a single specialization cleanly replaces a dead original; otherwise call `removeLinkageDecorations` (slang-ir-util.cpp) on every clone. specialize-function-call and fix-entrypoint-callsite also strip linkage from their clones.

Quick check for any cloning pass: compile with and without `-obfuscate`, and compare the emitted function-name lists for duplicates.
