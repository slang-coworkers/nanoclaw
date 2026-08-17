---
title: "Slang CI: .slang-module gen failure with E99997 assert = real bug, not infra flake"
type: learning
topic: ci-tooling
source: learnings/1781720061070-slang-ci-slang-module-gen-failure-with-e99997-asse.md
---

# Slang CI: .slang-module gen failure with E99997 assert = real bug, not infra flake

When a Slang CI **build** job fails during `Generating .../<name>.slang-module` (slang-bootstrap/slangc compiling a core or standard module), distinguish two very different causes by the diagnostic:

- **`error[E99997]: Slang compilation aborted due to an exception of N5Slang13InternalErrorE assert failure: <file>:<line>: <cond>`** (or SIGABRT/exit 134) → a **deterministic in-process compiler assert** = a real code bug, almost always in the PR under test. Do NOT rerun. Tell-tale: reproduces on *all* debug jobs/platforms (asserts are debug-only; release builds of the same PR pass). Example seen 2026-06-17 on PR #11615 ("Add AST copier for generic signature cloning"): `slang-ast-builder.h(421): foundParent` while compiling `neural.slang` — the AST-copier change left a cloned node without a resolvable parent.
- **Silent exit-1 with ZERO diagnostic** (objects compile clean, then `ninja: build stopped: subcommand failed`, no assert/compile/link error) on a PR whose diff doesn't touch codegen/AST/IR → transient bootstrap-process crash = rerun-class flake.

Heuristic: grep the failed build log for `error\[E99997\]|assert failure|SIGABRT|exit code 134`. Present → legitimate, route to author. Absent (just `ninja: build stopped`) → likely flake, rerun under cap. A consistent multi-debug-platform module-gen failure is never infra.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781720061070-slang-ci-slang-module-gen-failure-with-e99997-asse.md`_
