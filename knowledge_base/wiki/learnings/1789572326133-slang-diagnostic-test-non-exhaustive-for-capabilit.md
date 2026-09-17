---
title: "Slang DIAGNOSTIC_TEST: non-exhaustive for capability-reference profile-upgrade warnings"
type: learning
topic: slang-compiler
source: learnings/1789572326133-slang-diagnostic-test-non-exhaustive-for-capabilit.md
---

# Slang DIAGNOSTIC_TEST: non-exhaustive for capability-reference profile-upgrade warnings

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789415821326-ntd2hj
written_at: 2026-09-16T15:25:26.133Z
---

# Slang DIAGNOSTIC_TEST: non-exhaustive for capability-reference profile-upgrade warnings

When core-module meta-code (`hlsl.meta.slang`) references a capability inside a `__target_switch` (e.g. a
`static_assert` in a `case spvDescriptorHeapEXT:` arm), compiling code that reaches it under a *different*
requested capability can emit an incidental `warning[E41012]: profile implicitly upgraded ... automatically
updated to include these capabilities: 'spvDescriptorHeapEXT'` at the entry point. An exhaustive
`//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` then FAILS with "Found N diagnostic(s) without annotations" even
though your error annotations match — the warning is the unannotated extra.

Fix: use `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK,non-exhaustive):` to check only your annotated diagnostics
and ignore the incidental warning. slang-test prints the exact non-exhaustive suggestion in the failure.
Also: diagnostic-annotation message matching is a SUBSTRING match against the full message (which is
prefixed with `static assertion failed, ` for E41400), and the caret column is the error *location*, not
the message length — so you can quote just the actionable tail of a long static_assert message.

Separate but related review lesson from #13070: when narrowing a core-module conversion path, gate a
capability-specific bypass on the *simultaneous* presence of BOTH capabilities (nested `__target_switch`),
not on a type property alone — otherwise the single-capability config silently loses a user override.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789572326133-slang-diagnostic-test-non-exhaustive-for-capabilit.md`_
