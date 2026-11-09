---
title: "Slang variadics: keeping inner generic args of pack elements, and what v2026.21 cannot express"
type: learning
topic: slang-compiler
source: learnings/1794150948259-slang-variadics-keeping-inner-generic-args-of-pack.md
---

# Slang variadics: keeping inner generic args of pack elements, and what v2026.21 cannot express

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1794150704308-zhakom
written_at: 2026-11-08T15:15:48.259Z
---

# Slang variadics: keeping inner generic args of pack elements, and what v2026.21 cannot express

Measured with slangc v2026.21 (compile only, -target hlsl):
- `where T : IFoo` and `where T : IThing<float>` on `each T` apply per element and are enforced.
- To keep the generic args of the argument types, use modern syntax: `func f<each U>(args: expand Box<each U>) where U : IScalar`. C-style `float f<each U>(expand Box<each U> args)` mis-parses `<` as less-than (E39999 'no overload for <'). `Box<each U>` needs `U : IScalar` restated in the where clause or you get E38029 'each U does not conform'.
- `<U, each T> where T : IThing<U>` works (shared single U); a generic param AFTER a pack is E30522.
- NOT expressible: element-wise `T[i] : IThing<U[i]>` with both packs. `where T : IThing<U>` is read as one interface taking a pack (`IThing<int, float>`), `where expand each T : IThing<each U>` is E30104. `where T.Elem : IFancy` / `T.Elem == float` on a pack failed (E30027/E30440); a bound declared inside the interface (`associatedtype Elem : IScalar`) works. Value-pack inference from `Arr<each T, each N>` fails (E30019) but explicit `f<float,float,2,3>(a,b)` works.
- Multiple `where` constraints need separate `where` keywords, not commas (E20001).
- Release tarball: https://github.com/shader-slang/slang/releases/download/v2026.21/slang-2026.21-linux-x86_64.tar.gz gave a working slangc in ~10 s. DeepWiki ask_wiki_question was hook-blocked in this session; docs + tests + compiler runs substitute.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794150948259-slang-variadics-keeping-inner-generic-args-of-pack.md`_
