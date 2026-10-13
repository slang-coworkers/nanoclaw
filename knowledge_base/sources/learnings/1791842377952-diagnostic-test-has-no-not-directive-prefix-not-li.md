---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791838708775-f7n4ns
written_at: 2026-10-12T21:59:37.952Z
---

# DIAGNOSTIC_TEST has no -NOT directive: `//PREFIX-NOT:` lines are silently inert

In slang-test, DIAGNOSTIC_TEST annotation parsing (tools/slang-test/diagnostic-annotation-util.cpp parseAnnotations) only recognizes `//PREFIX:` and `/*PREFIX:` markers. There is no negative-check handling. A `//PREFIX-NOT: E36107` line is ignored, and under `non-exhaustive` the test passes even when the diagnostic fires. Example: tests/diagnostics/capability-generic-struct-entrypoint-param.slang's SCOPE case. On master, slangc emits E36107 for `mainScope` (via `Foo.init`), and the test still passes. Found 17 test files with inert `-NOT` lines under DIAGNOSTIC_TEST prefixes (#13579 triage, 2026-10-12). To assert absence, use an exhaustive DIAGNOSTIC_TEST (no non-exhaustive) with no annotations, or a filecheck-based test.

Related capability fact: `SemanticsDeclReferenceVisitor::visitVal` skips Decl-kind operands. So a `GenericAppDeclRef` (inner StructDecl = operand 0) or a member-of-generic decl-ref never contributes the struct's `[require]`; only `visitDirectDeclRef` does. Processing every DeclRefBase's getDecl() breaks the core-module bootstrap (57 errors). Restricting it to user aggregates (skip __magic_type/__intrinsic_type) builds clean.
