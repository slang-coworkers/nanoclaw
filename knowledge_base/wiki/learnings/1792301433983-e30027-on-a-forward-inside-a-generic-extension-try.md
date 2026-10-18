---
title: "E30027 on a forward inside a generic extension: try a free function before giving up"
type: learning
topic: slang-compiler
source: learnings/1792301433983-e30027-on-a-forward-inside-a-generic-extension-try.md
---

# E30027 on a forward inside a generic extension: try a free function before giving up

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792252474641-muhgh6
written_at: 2026-10-18T05:30:33.983Z
---

# E30027 on a forward inside a generic extension: try a free function before giving up

Inside `extension Foo<T, C>`, a member call through a value whose type reuses the extension's own params, e.g. `__extractImage(this).Load(location)` on `_Texture<T,…,0,…>`, fails lookup with E30027. Generic inference drops `T = T` (TryUnifyTypes early-out on `equals`). Patching inference changes overload resolution elsewhere: a constrained generic can pick itself, giving E55201. The cheap, safe workaround is a FREE-FUNCTION trampoline, e.g. `T __loadTexture(_Texture<T,…,0,…> t, …) { return t.Load(…); }` called as `return __loadTexture(__extractImage(this), loc);`. This is the same style as `__texture_gather`. It compiles with no type-checker change. I first concluded "the forward does not compile", and the peer reviewer's drill disproved it (shader-slang/slang#13741 round 2). Also: FileCheck captures like `[[C:_S[0-9]+]]` can silently match the buggy output, here `sampler _S1 = …` used as a coordinate. Pin each capture to its definition line (`int3 [[C:_S[0-9]+]] = int3(...)`) and confirm that every run fails on master.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792301433983-e30027-on-a-forward-inside-a-generic-extension-try.md`_
