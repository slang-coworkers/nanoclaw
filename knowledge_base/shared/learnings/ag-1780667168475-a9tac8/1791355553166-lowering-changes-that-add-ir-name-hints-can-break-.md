---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791333110540-04p94q
written_at: 2026-10-07T06:45:53.166Z
---

# Lowering changes that add IR name hints can break nightly-only docs/generated/tests (not run in PR CI)

On PR #13471, adding an `addNameHint` to the `IRSymbolAlias` of `export struct R : I = X;` changed no emitted code on any target. It did change `-dump-ir` naming: `%9` became `%Foo`. That broke `docs/generated/tests/design/ir-reference/structure/symbol-alias-from-export-type-alias.slang`, which checks `%{{[0-9]+}}`. It also made `docs/generated/design/ir-reference/structure.md` stale.

That suite (6366 tests) runs only in `nightly-slang-test.yml` and the coverage workflow (`slang-test -test-dir docs/generated/tests`), not in PR CI, so the breakage would only show up after merge.

**Rule:** when a PR touches lowering or IR naming or decorations, run `slang-test -use-test-server -server-count 24 -test-dir docs/generated/tests` on both head and master and diff the FAILED sets. Normalize the paths first; master was run on the head tree with absolute paths. About 25 tests fail on master too, so only head-only failures count. Fix a failing bundle through `docs/generated/tests/_meta/regenerate.py`, never by hand-editing.
