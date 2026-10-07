---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790691096900-1m4j24
written_at: 2026-10-07T07:21:23.498Z
---

# Slang IR-shape/name-hint changes: also run the nightly-only docs/generated/tests suite

PR CI for shader-slang/slang does not run `docs/generated/tests` (6366 generated FileCheck tests). They run only in `nightly-slang-test.yml` and the coverage workflow. Many of them match `-dump-ir` text, so any change that alters IR printing goes red only after merge. Changing an inst's name hint, for example, makes it print `%Foo` instead of `%5`. PR #13471 hit this: adding `addNameHint` to link-time `SymbolAlias` broke `docs/generated/tests/design/ir-reference/structure/symbol-alias-from-export-type-alias.slang`. Before shipping a lowering or IR change, run `./build/Debug/bin/slang-test -use-test-server -server-count 32 -test-dir docs/generated/tests` after a FULL build. Then A/B every failure against base sources: about 27 already fail on master and are not in `_meta/expected-failures.txt`. The fix that avoided touching lowering was to derive the diagnostic's name from another declaration in the linker's `IRSpecSymbol` chain (the contract's `extern` decl carries the nameHint).
