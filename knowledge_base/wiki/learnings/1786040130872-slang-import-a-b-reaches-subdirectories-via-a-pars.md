---
title: "Slang `import a.b` reaches subdirectories via a PARSER dot→slash rewrite; `-I` itself is non-recursive and quoted imports get no sugar"
type: learning
topic: slang-compiler
source: learnings/1786040130872-slang-import-a-b-reaches-subdirectories-via-a-pars.md
---

# Slang `import a.b` reaches subdirectories via a PARSER dot→slash rewrite; `-I` itself is non-recursive and quoted imports get no sugar

Measured 2026-08-06 @ master `d7d59f374` (Release slangc) while triaging shader-slang/slang#12404. Two subagents and DeepWiki each got half of this wrong, so it is worth writing down precisely.

## `-I` search is NON-recursive, but dotted import names DO reach subdirectories
- Dep at `packages/mylib/src/mylib.slang`, `import mylib;`, `-I packages` ⇒ **FAIL** `error[E00001]: cannot open file 'mylib.slang'`. Positive controls: same file directly in the `-I` dir ⇒ exit 0; `-I packages/mylib/src` ⇒ exit 0. The search loop combines each search dir with the requested relative path at depth 1 only (`source/compiler-core/slang-include-system.cpp:124-136`).
- BUT `import mylib.core;` with the file at `<root>/mylib/core.slang` and a single `-I <root>` ⇒ **exit 0**.

⇒ One `-I` root CAN serve a whole hierarchy, provided modules are imported with **dotted** names.

## The mechanism is in the PARSER, not in the filename helper
`source/slang/slang-parser.cpp:1341-1352`, `parseFileReferenceDeclBase`: comment *"We allow a dotted format for the name, as sugar"*, and the loop appends `/` for each `Dot` token. So the module NAME already contains slashes before file lookup.

`getFileNameFromModuleName` (`source/slang/slang-session.cpp:1468-1489`) does **underscore→dash and `.slang` append ONLY — no dot handling at all**. Grepping there for dot translation returns nothing and reads as "the feature doesn't exist". Look at the parser.

## Guilty control that settles it
Delete the target file and re-run: the diagnostic becomes `cannot open file 'mylib/core.slang'` — **with a slash**. That proves the translation happened, which a plain exit-0 does not. (Also confirmed the symbol is really visible: emitted HLSL contained `coreAnswer_0()`.)

## Three sharp edges, all measured
1. **Quoted imports get NO sugar.** `import "mylib.core";` ⇒ `cannot open file 'mylib.core.slang'` (literal dot). Sugar is for the unquoted identifier form only (`slang-parser.cpp:1329` vs `:1337`).
2. **A module's `module` declaration need not match its import path.** A file declaring `module "totally.wrong";` still imports cleanly as `mylib.core`. Nothing enforces path/name agreement.
3. **`module mylib.core;` is invalid syntax** — a module declaration takes one identifier or one string literal, no dotted sugar. In-tree standard modules use `import slang.neural;` with `module neural;` inside.

## Related, and a trap
Outside the language server, `.slang-module` (IR) is tried **before** source (`slang-session.cpp:1583-1596`), so a stale binary module shadows fresher source. `UseUpToDateBinaryModule` freshness validation rejects stale IR **only when the corresponding source is reachable** — if the module's own source is missing, the standalone binary is accepted (`slang-session.cpp:1875-1881`).

Prior art for layout: `slang-standard-module-<version>/` ships source + IR side by side (`lib/` on Linux/macOS, `bin/` on Windows — `source/standard-modules/CMakeLists.txt:19-23`), auto-resolved with no `-I` as a fallback after normal search, and the source comment at `slang-session.cpp:45` documents the hierarchical mapping.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786040130872-slang-import-a-b-reaches-subdirectories-via-a-pars.md`_
