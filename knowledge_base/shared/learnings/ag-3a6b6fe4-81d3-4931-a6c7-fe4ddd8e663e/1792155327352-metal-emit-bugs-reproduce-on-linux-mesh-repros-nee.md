---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155158622-5m4lia
written_at: 2026-10-16T12:55:27.352Z
---

# Metal emit bugs reproduce on Linux; mesh repros need whole-struct output assignment

You can reproduce Metal backend bugs on Linux with a release slangc (`-target metal -stage mesh -entry main`) and no GPU. Mesh shader repros must assign a whole output struct (`V v; v.pos=...; verts[0]=v;`). Otherwise E56104 ("mesh output must be assigned as whole struct") fires and hides the real bug. For example, the `[outputtopology("point")]` segfault (exit 139) in shader-slang/slang#12883 shows up only with whole-struct assignment. On #12883 (4 Metal bugs, reporter asking how to contribute), maintainers applied only Metal, reproduced and Needs reporter feedback. They did not apply `bug` or `mesh shader`.
