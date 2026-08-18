---
title: "slang #11531 Approach B core-module safety rests on as&lt;NamespaceDecl&gt; filter, not 'no namespaced core extensions'"
type: learning
topic: slang-compiler
source: learnings/1781086844343-slang-11531-approach-b-core-module-safety-rests-on.md
---

# slang #11531 Approach B core-module safety rests on as&lt;NamespaceDecl&gt; filter, not "no namespaced core extensions"

Context: PR shader-slang/slang#11534 fixes #11531 (extension header in a reopened namespace fragment fails unqualified lookup). It uses **Approach B** — in `checkModule`, after `discoverExtensionDecls` and before the extension-first state loop, drive each extension's enclosing `NamespaceDecl` ancestors to `ScopesWired` (outermost-first). (Triage's recommended Approach A — module-wide `ensureAllDeclsRec(moduleDecl, ScopesWired)` before the extension loop — was implemented and **rejected**: it regressed the embedded core module, hlsl.meta.slang `extension _Texture<float,…>` → float not conforming to ITexelElement → E30855/abort.)

Non-obvious finding (3 independent reviewers, 2026-06-10):
- The PR body justifies B's core-module safety with "core module extensions are at global scope and have no enclosing `NamespaceDecl`." **That claim is factually false.** `hlsl.meta.slang` has `namespace linalg { … extension<…> TensorLayout … extension<…> TensorView … }` (around :27405–30107). So B's loop **does** drive a core-module namespace (`linalg`) to `ScopesWired` early during core-module bootstrap.
- B is still benign, but for a **different** reason than stated: `linalg` is a single fragment (no same-name siblings for `visitNamespaceDecl` to wire), and `ensureDecl(ns, ScopesWired)` advances only the namespace decl, not its members.
- The actual load-bearing safety guard is the **`as<NamespaceDecl>(p)` filter** in the parent walk. `ModuleDecl` and `NamespaceDecl` both derive from `NamespaceDeclBase`; `FileDecl` is a `ContainerDecl`. Matching `NamespaceDecl` specifically is what stops the pre-pass from forcing a global-scope (module/file) extension's enclosing scope to `ScopesWired` early. A future maintainer who widens that cast to `NamespaceDeclBase` would silently reintroduce the rejected core-module regression — and that rationale currently lives only in the PR description, not the code.

Also useful: the "folding this pre-pass into the existing extension-first state loop would reintroduce the bug" worry is **unfounded** — the extension-first loop drives all extensions to `ScopesWired` in its first iteration before any reaches `ReadyForLookup` (where `visitExtensionDecl` resolves the header), so wiring would still land before header resolution. The standalone pre-pass is a clarity choice, not a correctness requirement.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781086844343-slang-11531-approach-b-core-module-safety-rests-on.md`_
