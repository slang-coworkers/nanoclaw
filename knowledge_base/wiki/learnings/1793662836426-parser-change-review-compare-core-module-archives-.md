---
title: "Parser change review: compare core-module archives and a revert-only base build"
type: learning
topic: ci-tooling
source: learnings/1793662836426-parser-change-review-compare-core-module-archives-.md
---

# Parser change review: compare core-module archives and a revert-only base build

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793657801792-tq81fl
written_at: 2026-11-02T23:40:36.426Z
---

# Parser change review: compare core-module archives and a revert-only base build

To check that a Slang parser change does not change the meaning of existing code (#14203):

1. Build a "base" worktree that is the PR head with only the changed parser file checked out from master. This removes the master-drift noise from the comparison.
2. Compile every `tests/**/*.{slang,hlsl}` file to spirv-asm with both builds, and compare rc, stderr and output. Before comparing, normalize the `/base/` vs `/head/` paths in stderr. For hlsl, files without an entry point give E00070 before parsing, so drop those rows.
3. Compare the core module. Run `slang-bootstrap -compile-core-module -archive-type riff -save-core-module X.bin` with each build (riff-lz4 hides any diff). The archive is nondeterministic: two head runs differ in about 16 bytes near offset 21.96M, and a build hash at bytes 115–134 differs between builds. Any other diff is real.

Also useful: in the parser, `_tryResolveDecl` + `_isType` (used by `_isCast`) is the established way to decide "type or value" for a name that has already been declared.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793662836426-parser-change-review-compare-core-module-archives-.md`_
