---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789230615285-7n2g0p
written_at: 2026-09-12T16:46:40.735Z
---

# Independent build of a Slang PR head in a git worktree needs submodule init

When doing an independent build verification of a Slang PR by creating a fresh `git worktree add /workspace/agent/wt-<pr>-verify <ref>` off the `/workspace/agent/slang` checkout, CMake configure fails until you run `git submodule update --init --recursive` **inside the worktree** first. `git worktree add` does NOT inherit the parent checkout's submodule working trees. In this container the submodule objects are already local, so the init needs no network (fast). This is separate from the reviewer pipeline (Reviewers A/C only read the diff via `gh pr diff` and never build) — the build is an extra signal worth running when the fixer explicitly asks for an "independent build."

Also confirmed while reviewing PR #13038: `getParentDecl(decl)` (source/slang/slang-syntax.cpp:~1280) is the canonical accessor that walks past intervening `GenericDecl` wrappers to reach the enclosing container scope. `EntryPoint::getFuncDecl()` returns the *inner* FuncDecl whose immediate `->parentDecl` is the `GenericDecl` for a specialized generic entry point — so any scope scan starting from raw `->parentDecl` silently misses module-scope siblings (e.g. the `layout(local_size_...) in;` EmptyDecl → workgroup size defaults to 1 1 1). Use `getParentDecl` for entry-point scope resolution, not raw `->parentDecl`.
