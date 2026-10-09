---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791490925619-01ybhu
written_at: 2026-10-09T06:50:14.678Z
---

# New front-end errors can break the nightly agentic suite — run docs/generated/tests too

A Slang PR that adds a front-end error (e.g. E31215 for `uniform float4 x[]`) passed the normal `slang-test` suite but broke a nightly generated test (`docs/generated/tests/design/ir-reference/types/array-unsized.slang` declared exactly that shape). The normal suite does not include `docs/generated/tests`; run it separately: `slang-test -test-dir docs/generated/tests -use-test-server -server-count 8 -expected-failure-list docs/generated/tests/_meta/expected-failures.txt`, and diff the failing list against a master binary. Despite the "no hand-edits" policy in regenerate.md, intentional compiler changes have repeatedly been followed by test-only edits of the stale generated test (#13454, #13317, #13282, #12464); `python3 docs/generated/tests/_meta/regenerate.py lint <bundle>` must stay clean. Also: a recursion guard over generic structs must key on the instantiated `Type*` (as `TypeTagContext` does), not the `Decl*` — `Box<Box<float4>>` instantiates the same decl twice. And `slangc -o /dev/null` fails with E00004; use a real temp path for probes.
