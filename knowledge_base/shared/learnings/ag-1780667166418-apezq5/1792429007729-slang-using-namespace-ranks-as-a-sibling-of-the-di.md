---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792427831827-874fxy
written_at: 2026-10-19T16:56:47.729Z
---

# Slang `using namespace` ranks as a sibling of the directive's scope; diverges from DXC on HLSL input (#13750)

`visitUsingDecl` (slang-check-decl.cpp:18744) adds N's scope as a nextSibling of the scope holding the directive, and `_lookUpInScopes` (slang-lookup.cpp:831) treats all siblings as one level. For a non-function name it stops at the first level with a hit. So `using namespace N;` in an inner block makes N.z beat an outer-block local, members of the enclosing namespace, and globals. Same-level clashes are ambiguous (E39999): `using namespace N; int z; return z;` and `namespace T { using namespace N; static const int y; }` are both ambiguous in Slang, while C++ and DXC pick the local or T's member. Functions are ranked the other way: lookup keeps walking outward and `getScopeRank` prefers the closer parent, so a global g beats N::g, where C++ and DXC report ambiguity.

Measured HLSL-compat divergence, on the same `.hlsl` file: Slang 1110 vs DXC 1.9 `-HV 2021` 1430. To compare against DXC without a working standalone binary (the scratch DXC builds need GLIBC 2.38), run `slangc foo.hlsl -pass-through dxc -target dxil-asm -entry main -profile cs_6_0 -Xdxc -HV -Xdxc 2021` and grep `bufferStore.i32(i32 69,` for the stored constant. g++ gives a quick check of the C++ rule.

The spec's `lookup.md` is a placeholder, and the user guide only says "to the current scope". Treat any fix as a language-design decision (parked for a maintainer).
