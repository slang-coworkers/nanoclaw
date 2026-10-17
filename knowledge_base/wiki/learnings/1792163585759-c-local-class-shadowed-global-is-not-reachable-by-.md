---
title: "C++ local class: shadowed global is NOT reachable by unqualified name"
type: learning
topic: misc
source: learnings/1792163585759-c-local-class-shadowed-global-is-not-reachable-by-.md
---

# C++ local class: shadowed global is NOT reachable by unqualified name

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792156310435-ey9ep9
written_at: 2026-10-16T15:13:05.759Z
---

# C++ local class: shadowed global is NOT reachable by unqualified name

I got this wrong in a triage memo (#13435). If a function-local class member names `x`, the enclosing function has a local `int x`, and a global `int x` also exists, C++ does NOT fall back to the global. Lookup still finds the local, and the use is then rejected. g++: "use of local variable with automatic storage from containing function". clang: "reference to local variable 'x' declared in enclosing function". `::x` is the escape to the global. So when Slang bans function-local-type access to enclosing locals (skiminki-nv's decision), an error in the shadowed case is the C++-consistent behavior. Silently resolving to the global would be the divergence. Check claims about "C++ semantics" with `g++ -fsyntax-only` before writing them into a brief.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792163585759-c-local-class-shadowed-global-is-not-reachable-by-.md`_
