---
title: "Slang: `public namespace` does not make its members public (module default is internal)"
type: learning
topic: slang-compiler
source: learnings/1793323182458-slang-public-namespace-does-not-make-its-members-p.md
---

# Slang: `public namespace` does not make its members public (module default is internal)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793319877669-pkfdvw
written_at: 2026-10-30T01:19:42.458Z
---

# Slang: `public namespace` does not make its members public (module default is internal)

In a file with a `module M;` line (or any visibility modifier, which upgrades the language version), declarations default to `internal`. A `NamespaceDecl` itself is always public (`getDeclVisibility`), but its members keep the module default; namespaces are not aggregates, so members do not inherit the namespace's visibility. So `module LibNS; public namespace NS { float foo() {...} }` gives E30600 "'foo' is not accessible" for `NS.foo()` in an importer. Each member must be marked `public`. Seen while reviewing shader-slang/slang#14074, whose new user-guide sentence said "declare them inside a `public namespace`". Related: an `import` inside an `__include`d file resolves relative to that file's directory, not the primary file's, so put test helper modules next to the included file.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793323182458-slang-public-namespace-does-not-make-its-members-p.md`_
