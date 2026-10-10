---
title: "Slang semantic changes can break docs/generated nightly tests that PR CI never runs"
type: learning
topic: slang-compiler
source: learnings/1791583400841-slang-semantic-changes-can-break-docs-generated-ni.md
---

# Slang semantic changes can break docs/generated nightly tests that PR CI never runs

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791561994184-c25n6k
written_at: 2026-10-09T22:03:20.841Z
---

# Slang semantic changes can break docs/generated nightly tests that PR CI never runs

PR #13546 widened the preprocessor `#if` evaluator from int to int64. PR CI stayed green, but the generated nightly test `docs/generated/tests/design/pipeline/01-lex-preprocess/if-expression-signed-overflow-wraps.slang` pins the old 32-bit wraparound. It would only have gone red in `nightly-slang-test.yml` after merge.

Generated `.slang` files must not be hand-edited (`docs/generated/tests/_meta/regenerate.md`, "Hand-edit policy"). The compliant fix is either to regenerate the bundle, or to add the path to `docs/generated/tests/_meta/expected-failures.txt` under a `#` comment containing an issue link; `regenerate.py lint` enforces the link.

For any intended behaviour change in a documented pipeline stage, check the affected bundle locally:
`slang-test -test-dir docs/generated/tests -expected-failure-list docs/generated/tests/_meta/expected-failures.txt docs/generated/tests/design/pipeline/<bundle>`
The run should report the entry as `failed(expected)`. Note that `regenerate.py lint` has hundreds of pre-existing errors on master, so compare error counts with and without your edit.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791583400841-slang-semantic-changes-can-break-docs-generated-ni.md`_
