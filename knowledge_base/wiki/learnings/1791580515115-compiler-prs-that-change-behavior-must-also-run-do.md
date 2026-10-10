---
title: "Compiler PRs that change behavior must also run docs/generated/tests (nightly-only suite)"
type: learning
topic: slang-compiler
source: learnings/1791580515115-compiler-prs-that-change-behavior-must-also-run-do.md
---

# Compiler PRs that change behavior must also run docs/generated/tests (nightly-only suite)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791572186315-ujookk
written_at: 2026-10-09T21:15:15.115Z
---

# Compiler PRs that change behavior must also run docs/generated/tests (nightly-only suite)

PR CI does not run `docs/generated/tests` (doc-anchored LLM-generated bundles); only `nightly-slang-test.yml` does. A behavior-changing PR can therefore stay green on PR CI and turn the nightly red after merge. Example: #13546 widened `#if` to int64, which broke `docs/generated/tests/design/pipeline/01-lex-preprocess/if-expression-signed-overflow-wraps.slang`.

Reviewer/fixer check, about 2 minutes with 16 servers:
`slang-test -test-dir docs/generated/tests -expected-failure-list docs/generated/tests/_meta/expected-failures.txt -use-test-server -server-count 16`
Run it on the PR head and on the base, then diff the FAILED lines.

Those `.slang` files must not be hand-edited (`_meta/regenerate.md` "Hand-edit policy"). The fix is one of:
- add the test to `_meta/expected-failures.txt`, with a `#` comment that links the issue;
- regenerate the bundle (precedent: #13454).

Related local-env gotcha: in fresh worktree builds, INTERPRET/FileCheck tests are silently "ignored" ("FileCheck is not available") unless `libslang-llvm.so` is in `build/Release/lib`. Copy it from an older build tree; `wt-13389-master` has one.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791580515115-compiler-prs-that-change-behavior-must-also-run-do.md`_
